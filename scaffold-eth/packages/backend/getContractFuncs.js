export default function contractFunc(contract, signer) {
  const displayedContractFunctions = contract
    ? Object.entries(contract.interface.functions).filter(
        (fn) => fn[1]["type"] === "function"
      )
    : [];

  const functions = {};
  displayedContractFunctions.forEach((contractFuncInfo) => {
    const contractFunc =
      contractFuncInfo[1].stateMutability === "view" ||
      contractFuncInfo[1].stateMutability === "pure"
        ? contract[contractFuncInfo[0]]
        : contract.connect(signer)[contractFuncInfo[0]];
    if (typeof contractFunc === "function") {
      functions[contractFuncInfo[1].name] = async (args, overrides) =>
        overrides
          ? await contractFunc(...args, overrides)
          : await contractFunc(...args);
    }
  });
  return functions;
}
