import Portis from "@portis/web3";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Authereum from "authereum";
import Fortmatic from "fortmatic";
import WalletLink from "walletlink";
import Web3Modal from "web3modal";
import { INFURA_ID } from "../constants";

// Portis ID: 6255fb2b-58c8-433b-a2c9-62098c05ddc9
/**
  Web3 modal helps us "connect" external wallets:
**/
const web3ModalSetup = () =>
  new Web3Modal({
    network: "mainnet", // Optional. If using WalletConnect on xDai, change network to "xdai" and add RPC info below for xDai chain.
    cacheProvider: true, // optional
    theme: "light", // optional. Change to "dark" for a dark theme.
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider, // required
        options: {
          bridge: "https://polygon.bridge.walletconnect.org",
          infuraId: INFURA_ID,
          rpc: {
            10: "https://mainnet.optimism.io", // xDai
            100: "https://rpc.gnosischain.com", // xDai
            137: "https://polygon-rpc.com",
            31337: "http://localhost:8545",
            42161: "https://arb1.arbitrum.io/rpc",
            80001: "https://rpc-mumbai.maticvigil.com",
          },
        },
      },
      portis: {
        display: {
          logo: "https://user-images.githubusercontent.com/9419140/128913641-d025bc0c-e059-42de-a57b-422f196867ce.png",
          name: "Portis",
          description: "Connect to Portis App",
        },
        package: Portis,
        options: {
          id: "6255fb2b-58c8-433b-a2c9-62098c05ddc9",
        },
      },
      fortmatic: {
        package: Fortmatic, // required
        options: {
          key: "pk_live_5A7C91B2FC585A17", // required
        },
      },
      authereum: {
        package: Authereum, // required
      },
    },
  });

export default web3ModalSetup;
