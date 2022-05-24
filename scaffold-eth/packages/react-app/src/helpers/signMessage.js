export default async function signMessage(msg) {
  console.log(msg);
  if (!window.ethereum) {
    console.log("No crypto wallet found");
    return {};
  }
  try {
    await window.ethereum.send("eth_requestAccounts");
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const web3Signer = web3Provider.getSigner();
    const signature = await web3Signer.signMessage(msg);
    const addr = await web3Signer.getAddress();

    return {
      address: addr,
      message: msg,
      signature,
    };
  } catch (err) {
    console.log(err.message);
  }
}
