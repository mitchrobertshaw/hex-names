import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Cta, EthWarning, Faq, Features, HowItWorks, Pricing, SendToNames } from "./components/Sections";

export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <SendToNames />
        <Features />
        <HowItWorks />
        <EthWarning />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
