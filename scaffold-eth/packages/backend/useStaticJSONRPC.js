import { ethers } from "ethers";

const createProvider = async (url) => {
  console.log("url", url);
  const p = new ethers.providers.StaticJsonRpcProvider(url);
  console.log(p);
  await p.ready;

  return p;
};

export default async function useStaticJSONRPC(urlArray) {
  try {
    console.log("here");
    const p = await Promise.race(urlArray.map(createProvider));
    const _p = await p;

    return _p;
  } catch (error) {
    console.log("there");

    // todo: show notification error about provider issues
    console.log("error in getting provider", error);
  }
  console.log("done");

  return null;
}
