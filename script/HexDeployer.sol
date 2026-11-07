// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {GatewayProvider} from "@ens/contracts/ccipRead/GatewayProvider.sol";
import {IGatewayProvider} from "@ens/contracts/ccipRead/IGatewayProvider.sol";
import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

import {ETHRegistrar, REGISTRATION_ROLE_BITMAP} from "@ensv2/registrar/ETHRegistrar.sol";
import {IRentPriceOracle} from "@ensv2/registrar/interfaces/IRentPriceOracle.sol";
import {StandardRentPriceOracle, DiscountPoint, PaymentRatio} from "@ensv2/registrar/StandardRentPriceOracle.sol";
import {PermissionedRegistry} from "@ensv2/registry/PermissionedRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensv2/registry/libraries/RegistryRolesLib.sol";
import {PermissionedResolver} from "@ensv2/resolver/PermissionedResolver.sol";
import {IContractNamer} from "@ensv2/reverse-registrar/interfaces/IContractNamer.sol";
import {UniversalResolverV2} from "@ensv2/universalResolver/UniversalResolverV2.sol";
import {ContractNamer} from "@ensv2/utils/ContractNamer.sol";
import {LabelStore} from "@ensv2/utils/LabelStore.sol";
import {ILabelStore} from "@ensv2/utils/interfaces/ILabelStore.sol";

import {OwnerResolver} from "../src/common/OwnerResolver.sol";
import {HexMirrorRegistrar} from "../src/ethereum/HexMirrorRegistrar.sol";
import {HexOrderBook} from "../src/ethereum/HexOrderBook.sol";
import {IAMB} from "../src/interfaces/IAMB.sol";
import {IHexMirrorSync} from "../src/interfaces/IHexBridge.sol";
import {AnyTokenCheckout} from "../src/pulsechain/AnyTokenCheckout.sol";
import {HexMirrorSync} from "../src/pulsechain/HexMirrorSync.sol";
import {HexOrderFiller} from "../src/pulsechain/HexOrderFiller.sol";
import {ReservedName, ReservedNames} from "./ReservedNames.sol";

/// @title HexDeployer
/// @notice Deploys .hex: ENSv2 with a `hex` ending, the real registry on PulseChain and a copy on
///         Ethereum, joined by the official PulseChain bridge. Used by the deploy scripts and by
///         the tests, so the tests run against exactly what gets deployed.
/// @dev Settings follow ENSv2's own deployment (contracts-v2 script/deploy-constants.ts) except
///      the price of 5+ letter names: $10 a year, covering the name on both chains, instead of
///      ENS's $8.
abstract contract HexDeployer {
    // --- Registrar settings (ENSv2 defaults) ---
    uint64 internal constant GRACE_PERIOD = 28 days;
    uint64 internal constant MIN_COMMITMENT_AGE = 60 seconds;
    uint64 internal constant MAX_COMMITMENT_AGE = 1 days;
    uint64 internal constant MIN_REGISTER_DURATION = 28 days;

    // --- Prices ---
    /// @dev The oracle works in "standard units" with 12 decimals.
    uint256 internal constant PRICE_SCALE = 1e12;
    uint256 internal constant SEC_PER_YEAR = 365 days;
    /// @dev Dollars a year by length. Names of 1 or 2 characters are not for sale.
    uint256 internal constant YEARLY_PRICE_3 = 640;
    uint256 internal constant YEARLY_PRICE_4 = 160;
    uint256 internal constant YEARLY_PRICE_5_PLUS = 10; // one price for PulseChain and Ethereum
    /// @dev A name that just expired starts at $100 million and halves daily for 21 days, so
    ///      nobody can snipe it the moment it lapses.
    uint256 internal constant PREMIUM_PRICE_INITIAL = PRICE_SCALE * 100_000_000;
    uint64 internal constant PREMIUM_HALVING_PERIOD = 1 days;
    uint64 internal constant PREMIUM_PERIOD = 21 days;
    /// @dev Multi-year discounts: 12.5% from 2 years, 31.25% from 3, 43.75% from 6.
    uint128 internal constant DISCOUNT_DENOMINATOR = 1e38;

    /// @dev How long reserved names last from deployment. A held name can't be bought for that
    ///      long unless the admin hands it over; a given name is paid up for that long. The admin
    ///      can extend either.
    uint64 internal constant RESERVATION_PERIOD = 5 * 365 days;

    uint64 internal constant MAX_EXPIRY = type(uint64).max;
    uint256 internal constant ETHEREUM_CHAIN_ID = 1;
    uint256 internal constant PULSECHAIN_CHAIN_ID = 369;
    string internal constant TLD = "hex";

    /// @notice The ENSv2 contracts both chains have.
    struct Core {
        IContractNamer contractNamer; // UUPS proxy, owned by the admin
        LabelStore labelStore;
        PermissionedRegistry rootRegistry;
        PermissionedRegistry hexRegistry;
        OwnerResolver ownerResolver; // resolver of `hex`: names resolve to their owner by default
        GatewayProvider batchGatewayProvider;
        UniversalResolverV2 universalResolver; // what wallets and apps look names up through
        VerifiableFactory verifiableFactory; // deploys owners' own resolvers
        PermissionedResolver resolverImplementation;
    }

    /// @notice PulseChain: where names live and are sold.
    struct Hub {
        Core core;
        StandardRentPriceOracle oracle;
        ETHRegistrar registrar;
        HexMirrorSync mirrorSync;
        HexOrderFiller orderFiller;
        AnyTokenCheckout checkout;
    }

    struct HubConfig {
        address deployer; // the account sending the deployment; gives up its roles at the end
        address admin; // may change prices and payment tokens and add registrars; cannot take names
        address beneficiary; // receives every registration and renewal payment
        IAMB amb; // the bridge's message contract on PulseChain
        IERC20 usdc; // USDC bridged from Ethereum: accepted by the registrar, used by the checkout
        IERC20 dai; // DAI bridged from Ethereum: also accepted by the registrar
        IERC20 wpls;
        address[] routers; // PulseX routers for the checkout
        uint256 mirrorGas; // gas each Ethereum copy message asks for
        uint256 settleGas; // gas each Ethereum settlement message asks for
        ReservedName[] reserved; // set aside before anyone can buy names (see `_reserve`)
    }

    /// @notice Ethereum: a copy of every name, and orders for buying from Ethereum.
    struct Mirror {
        Core core;
        HexMirrorRegistrar mirrorRegistrar;
        HexOrderBook orderBook;
    }

    struct MirrorConfig {
        address deployer;
        address admin; // owns only the gateway list and the contract namer; has no say over names
        IAMB amb; // the bridge's message contract on Ethereum
        IERC20 usdc;
        IERC20 weth;
        address[] routers; // Uniswap-V2-style routers for paying with other tokens
        uint64 fillWindow;
        uint64 reclaimDelay;
    }

    // ------------------------------------------------------------------------------------------
    // PulseChain
    // ------------------------------------------------------------------------------------------

    /// @dev Deploys the PulseChain side. The two bridge contracts still need `link`ing to their
    ///      Ethereum partners afterwards, by `cfg.deployer`.
    function _deployHub(HubConfig memory cfg) internal returns (Hub memory hub) {
        // The .hex registry: the deployer may grant the registrar, renewer and reserved-name roles
        // and set the parent, nothing more. In particular nobody gets the roles to unregister,
        // transfer, or change the resolver of someone else's name.
        uint256 hexRegistryRoles = RegistryRolesLib.ROLE_REGISTRAR_ADMIN | RegistryRolesLib.ROLE_RENEW_ADMIN
            | RegistryRolesLib.ROLE_REGISTER_RESERVED_ADMIN | RegistryRolesLib.ROLE_SET_PARENT
            | RegistryRolesLib.ROLE_SET_PARENT_ADMIN;
        hub.core = _deployCore(cfg.deployer, cfg.admin, hexRegistryRoles);
        PermissionedRegistry hexRegistry = hub.core.hexRegistry;

        // Before the registrar exists, so nobody can buy a reserved name first.
        _reserve(hexRegistry, cfg.deployer, cfg.reserved);

        hub.oracle = new StandardRentPriceOracle(
            cfg.admin,
            _baseRates(),
            _discountPoints(),
            DISCOUNT_DENOMINATOR,
            PREMIUM_PRICE_INITIAL,
            PREMIUM_HALVING_PERIOD,
            PREMIUM_PERIOD,
            _paymentRatios(cfg.usdc, cfg.dai)
        );
        hub.registrar = new ETHRegistrar(
            cfg.admin,
            hexRegistry,
            cfg.beneficiary,
            IRentPriceOracle(address(hub.oracle)),
            GRACE_PERIOD,
            MIN_COMMITMENT_AGE,
            MAX_COMMITMENT_AGE,
            MIN_REGISTER_DURATION
        );
        hexRegistry.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_RENEW, address(hub.registrar)
        );

        hub.mirrorSync = new HexMirrorSync(cfg.amb, ETHEREUM_CHAIN_ID, cfg.deployer, hexRegistry, cfg.mirrorGas);
        hub.orderFiller = new HexOrderFiller(
            cfg.amb,
            ETHEREUM_CHAIN_ID,
            cfg.deployer,
            hub.registrar,
            IHexMirrorSync(address(hub.mirrorSync)),
            cfg.usdc,
            cfg.settleGas
        );
        hub.checkout = new AnyTokenCheckout(
            hub.registrar, cfg.usdc, cfg.wpls, cfg.routers, IHexMirrorSync(address(hub.mirrorSync))
        );

        // Hand over: the admin may add registrars and renewers later (neither can take a name),
        // may hand held reserved names to their owners, and may add new endings to the root.
        // Then the deployer gives up everything.
        hexRegistry.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR_ADMIN | RegistryRolesLib.ROLE_RENEW_ADMIN
                | RegistryRolesLib.ROLE_REGISTER_RESERVED,
            cfg.admin
        );
        hub.core.rootRegistry
            .grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_REGISTRAR_ADMIN, cfg.admin);
        _renounce(hub.core, cfg.deployer, hexRegistryRoles);
    }

    // ------------------------------------------------------------------------------------------
    // Ethereum
    // ------------------------------------------------------------------------------------------

    /// @dev Deploys the Ethereum side. The two bridge contracts still need `link`ing to their
    ///      PulseChain partners afterwards, by `cfg.deployer`.
    function _deployMirror(MirrorConfig memory cfg) internal returns (Mirror memory mirror) {
        uint256 hexRegistryRoles = RegistryRolesLib.ROLE_REGISTRAR_ADMIN | RegistryRolesLib.ROLE_UNREGISTER_ADMIN
            | RegistryRolesLib.ROLE_RENEW_ADMIN | RegistryRolesLib.ROLE_SET_PARENT
            | RegistryRolesLib.ROLE_SET_PARENT_ADMIN;
        mirror.core = _deployCore(cfg.deployer, cfg.admin, hexRegistryRoles);

        mirror.mirrorRegistrar =
            new HexMirrorRegistrar(cfg.amb, PULSECHAIN_CHAIN_ID, cfg.deployer, mirror.core.hexRegistry);
        mirror.core.hexRegistry
            .grantRootRoles(
                RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_UNREGISTER | RegistryRolesLib.ROLE_RENEW,
                address(mirror.mirrorRegistrar)
            );
        mirror.orderBook = new HexOrderBook(
            cfg.amb,
            PULSECHAIN_CHAIN_ID,
            cfg.deployer,
            cfg.usdc,
            cfg.weth,
            cfg.routers,
            cfg.fillWindow,
            cfg.reclaimDelay
        );

        // Nobody but `HexMirrorRegistrar` may ever write the Ethereum copy, so no admin is kept.
        _renounce(mirror.core, cfg.deployer, hexRegistryRoles);
    }

    // ------------------------------------------------------------------------------------------
    // Shared
    // ------------------------------------------------------------------------------------------

    /// @dev Deploys the ENSv2 contracts both chains have, with `hex` registered in the root under
    ///      no roles: nobody can ever replace the .hex registry or its default resolver.
    function _deployCore(address deployer, address admin, uint256 hexRegistryRoles)
        internal
        returns (Core memory core)
    {
        ContractNamer namerImplementation = new ContractNamer();
        core.contractNamer = IContractNamer(
            address(new ERC1967Proxy(address(namerImplementation), abi.encodeCall(ContractNamer.initialize, (admin))))
        );
        core.labelStore = new LabelStore(core.contractNamer);
        core.rootRegistry = new PermissionedRegistry(
            ILabelStore(address(core.labelStore)),
            deployer,
            RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_REGISTRAR_ADMIN
        );
        core.hexRegistry = new PermissionedRegistry(ILabelStore(address(core.labelStore)), deployer, hexRegistryRoles);
        core.ownerResolver = new OwnerResolver(IRegistry(address(core.rootRegistry)));

        // The `hex` token goes to the admin with no roles: it cannot be transferred, and holding it
        // gives no say over the .hex registry or its resolver.
        core.rootRegistry
            .register(TLD, admin, IRegistry(address(core.hexRegistry)), address(core.ownerResolver), 0, MAX_EXPIRY);
        core.hexRegistry.setParent(IRegistry(address(core.rootRegistry)), TLD);

        string[] memory urls = new string[](1);
        urls[0] = "x-batch-gateway:true";
        core.batchGatewayProvider = new GatewayProvider(admin, urls);
        core.universalResolver = new UniversalResolverV2(
            IPermissionedRegistry(address(core.rootRegistry)),
            IGatewayProvider(address(core.batchGatewayProvider)),
            core.contractNamer
        );
        core.verifiableFactory = new VerifiableFactory();
        core.resolverImplementation = new PermissionedResolver(admin);
    }

    /// @dev Sets aside `names` in the .hex registry. A name with an owner is registered to it with
    ///      the roles a buyer gets. A name without one is held (ENSv2's RESERVED status): the
    ///      registrar won't sell it, and only the admin can hand it to an owner, keeping the same
    ///      expiry. Both last `RESERVATION_PERIOD`. The deployer is a registrar only while doing this.
    function _reserve(PermissionedRegistry registry, address deployer, ReservedName[] memory names) internal {
        if (names.length == 0) return;
        registry.grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR, deployer);
        uint64 expiry = uint64(block.timestamp) + RESERVATION_PERIOD;
        for (uint256 i = 0; i < names.length; ++i) {
            ReservedNames.requireValidLabel(names[i].label);
            address owner = names[i].owner;
            registry.register(
                names[i].label,
                owner,
                IRegistry(address(0)),
                address(0),
                owner == address(0) ? 0 : REGISTRATION_ROLE_BITMAP,
                expiry
            );
        }
        registry.revokeRootRoles(RegistryRolesLib.ROLE_REGISTRAR, deployer);
    }

    /// @dev The deployer gives up every role it held on the two registries.
    function _renounce(Core memory core, address deployer, uint256 hexRegistryRoles) internal {
        core.hexRegistry.revokeRootRoles(hexRegistryRoles, deployer);
        core.rootRegistry
            .revokeRootRoles(RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_REGISTRAR_ADMIN, deployer);
    }

    /// @dev Base prices per second, in standard units, by length (index 0 = 1 character).
    function _baseRates() internal pure returns (uint256[] memory rates) {
        rates = new uint256[](5);
        rates[2] = _perSecond(YEARLY_PRICE_3);
        rates[3] = _perSecond(YEARLY_PRICE_4);
        rates[4] = _perSecond(YEARLY_PRICE_5_PLUS);
    }

    function _perSecond(uint256 dollarsPerYear) internal pure returns (uint256) {
        return (PRICE_SCALE * dollarsPerYear + SEC_PER_YEAR - 1) / SEC_PER_YEAR; // rounded up, as ENS does
    }

    function _discountPoints() internal pure returns (DiscountPoint[] memory points) {
        points = new DiscountPoint[](3);
        points[0] = DiscountPoint({duration: uint64(2 * SEC_PER_YEAR), numer: DISCOUNT_DENOMINATOR / 8 * 7});
        points[1] = DiscountPoint({duration: uint64(3 * SEC_PER_YEAR), numer: DISCOUNT_DENOMINATOR / 16 * 11});
        points[2] = DiscountPoint({duration: uint64(6 * SEC_PER_YEAR), numer: DISCOUNT_DENOMINATOR / 16 * 9});
    }

    /// @dev Exchange rates from standard units (12 decimals) to each stablecoin's own decimals.
    function _paymentRatios(IERC20 usdc, IERC20 dai) internal view returns (PaymentRatio[] memory ratios) {
        ratios = new PaymentRatio[](2);
        ratios[0] = _ratio(usdc);
        ratios[1] = _ratio(dai);
    }

    function _ratio(IERC20 token) internal view returns (PaymentRatio memory) {
        uint8 decimals = IERC20Metadata(address(token)).decimals();
        uint128 numer = decimals > 12 ? uint128(10 ** (decimals - 12)) : 1;
        uint128 denom = decimals < 12 ? uint128(10 ** (12 - decimals)) : 1;
        return PaymentRatio({paymentToken: token, numer: numer, denom: denom});
    }
}
