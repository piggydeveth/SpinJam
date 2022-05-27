import { ethers } from "ethers";

const createProvider = async (url) => {
  const p = new ethers.providers.StaticJsonRpcProvider(url);
  await p.ready;

  return p;
};

export default async function useStaticJSONRPC(urlArray) {
  try {
    const p = await Promise.race(urlArray.map(createProvider));
    const _p = await p;

    return _p;
  } catch (error) {
    // todo: show notification error about provider issues
    console.log("error in getting provider", error);
  }
  return null;
}
