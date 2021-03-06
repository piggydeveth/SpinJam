import React from 'react';
import './App.css';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import {
  chain,
  configureChains,
  createClient,
  WagmiConfig,
} from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
import { ConnectButton } from '@rainbow-me/rainbowkit';


const { chains, provider } = configureChains(
  [chain.rinkeby, chain.mainnet],
  [
    alchemyProvider({ alchemyId: process.env.ALCHEMY_ID }),
    publicProvider()
  ]
);
const { connectors } = getDefaultWallets({
  appName: 'SpinJam',
  chains
});
const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
})

function YourApp() {
  return (
    <div className="App">
      <ConnectButton showBalance={false} />
      <header className="App-header">
        ... coming soon
      </header>
    </div>
  );
}
const App = () => {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider coolMode chains={chains}>
        <YourApp />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};
export default App;
