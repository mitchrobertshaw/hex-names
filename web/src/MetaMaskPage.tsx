import { CheckIcon } from "./components/icons";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { VideoFacade } from "./components/VideoFacade";
import { youtubeWatchUrl } from "./lib/youtube";
import { appUrl, SNAP_REPO, SNAP_VIDEO_ID } from "./site";

const VIDEO_TITLE = "PulseChain Names: send to .hex, .pdai and .pls names in MetaMask";

/**
 * hexns.domains/metamask: PulseChain Names, HexNS's MetaMask snap, with its demo video. Unlisted:
 * nothing on the site links here, and search engines are asked not to list it (metamask/index.html).
 */
export function MetaMaskPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav home="/" />
      <main id="main">
        <section className="snap-hero" aria-labelledby="snap-title">
          <div className="container snap">
            <div className="snap__head">
              <p className="kicker">MetaMask snap</p>
              <h1 id="snap-title">
                Send to <span className="grad-text">.hex</span> names, right in MetaMask
              </h1>
              <p className="snap__lede">
                PulseChain Names is a free MetaMask snap, built by HexNS. Type a name in MetaMask&rsquo;s send
                screen, and it finds the address the name points to.
              </p>
            </div>

            <div className="snap__video">
              <VideoFacade id={SNAP_VIDEO_ID} title={VIDEO_TITLE} poster="/metamask-video.png" length="0:50" />
              <p className="snap__video-note">
                50 seconds, with captions.{" "}
                <a href={youtubeWatchUrl(SNAP_VIDEO_ID)} target="_blank" rel="noopener noreferrer">
                  Watch on YouTube
                </a>
              </p>
            </div>

            <div className="snap__body">
              <ul className="ticks">
                <li>
                  <CheckIcon size={18} /> .hex names on PulseChain and Ethereum, plus .pdai and .pls names on PulseChain
                </li>
                <li>
                  <CheckIcon size={18} /> Shows which name service found each address
                </li>
                <li>
                  <CheckIcon size={18} /> Only reads public records: it never signs, never sends, and never sees your keys
                </li>
              </ul>
              <div className="snap__actions">
                <a className="button button--primary" href={appUrl()}>
                  Get your .hex name
                </a>
                <a className="button button--ghost" href={`${SNAP_REPO}/blob/main/FAQ.md#how-do-i-install-it`}>
                  How to install it
                </a>
              </div>
              <p className="snap__note">
                Coming to the MetaMask Snaps Directory once MetaMask has reviewed it.
              </p>
              <ul className="snap__links" aria-label="More about PulseChain Names">
                <li>
                  <a href={`${SNAP_REPO}/blob/main/FAQ.md`}>FAQ</a>
                </li>
                <li>
                  <a href={`${SNAP_REPO}/blob/main/KNOWLEDGE_BASE.md`}>Knowledge base</a>
                </li>
                <li>
                  <a href={SNAP_REPO}>Source code</a>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer home="/" />
    </>
  );
}
