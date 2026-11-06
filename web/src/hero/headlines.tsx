// The headlines to choose between. The preview picker switches them; once one is chosen, the
// picker and the rest of these can go.
import type { ReactNode } from "react";

const Grad = ({ children }: { children: ReactNode }) => <span className="grad-text">{children}</span>;

export interface Headline {
  id: string;
  text: string;
  content: ReactNode;
}

export const HEADLINES: Headline[] = [
  {
    id: "A",
    text: "The .hex name service for PulseChain and Ethereum",
    content: (
      <>
        The <Grad>.hex</Grad> name service for PulseChain and Ethereum
      </>
    ),
  },
  {
    id: "B",
    text: "Your .hex name on PulseChain and Ethereum",
    content: (
      <>
        Your <Grad>.hex</Grad> name on PulseChain and Ethereum
      </>
    ),
  },
  {
    id: "C",
    text: "One .hex name for PulseChain and Ethereum",
    content: (
      <>
        One <Grad>.hex</Grad> name for PulseChain and Ethereum
      </>
    ),
  },
  {
    id: "D",
    text: "Get your .hex name for PulseChain and Ethereum",
    content: (
      <>
        Get your <Grad>.hex</Grad> name for PulseChain and Ethereum
      </>
    ),
  },
  {
    id: "E",
    text: "Your web3 username for PulseChain and Ethereum",
    content: (
      <>
        Your <Grad>web3 username</Grad> for PulseChain and Ethereum
      </>
    ),
  },
];

export const DEFAULT_HEADLINE = "A";
