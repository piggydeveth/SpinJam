export default function contractFunc(contract, signer) {
  const displayedContractFunctions = contract
    ? Object.values(contract.interface.functions).filter(
        (v) => v["type"] === "function"
      )
    : [];
  console.log(displayedContractFunctions);
  const functions = {};
  displayedContractFunctions.forEach((contractFuncInfo) => {
    const contractFunc =
      contractFuncInfo.stateMutability === "view" ||
      contractFuncInfo.stateMutability === "pure"
        ? contract[contractFuncInfo[0]]
        : contract.connect(signer)[contractFuncInfo[0]];
    console.log(contractFunc);
    if (typeof contractFunc === "function") {
      console.log("func");
      functions[contractFuncInfo.name] = contractFunc;
    }
  });
  return functions;
}
