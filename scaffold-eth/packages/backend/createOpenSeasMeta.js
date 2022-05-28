import ipfsAPI from "ipfs-api";
const ipfs = ipfsAPI("ipfs.infura.io", "5001", { protocol: "https" });

export default async function createOpenSeasMeta(fileUrl) {
  const baseJSON = {
    name: "SpinJamGif",
    description:
      "SpinJam gifs are the coolest competitively made gifs on the market",
    image: fileUrl,
    seller_fee_basis_points: 100, // Indicates a 1% seller fee.
    fee_recipient: "0x693eD51498C2c54d08b472695560F95358F1Db7C", // Where seller fees will be paid to.
  };
  const result = await ipfs.add(Buffer.from(JSON.stringify(baseJSON)));
  console.log(result);
}
// resulting metadata url from vv >> https://ipfs.io/ipfs/QmWsNx1bdmDyJyeXJtyqUSctrFEcje9P72Lk4XcnsWg7pu
// createOpenSeasMeta(
//   "https://ipfs.io/ipfs/QmcWyaupnqCfxfZUQpoeYrJNZZnPpzgW4ApUX1f3qPwFSa"
// );

// resulting metadata url from vv >> https://ipfs.io/ipfs/QmR3CXMwfoUcRDRYS8bB8CrvuHpAA8NXfdggyimmvR5dQp
// createOpenSeasMeta(
//   "https://ipfs.io/ipfs/QmUbSwQd96oopuQxviQYzvrShc3EMwsmSt55aGfxpsNxh2"
// );
