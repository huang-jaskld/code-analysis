const path = require("path");
const tsCompiler = require("typescript");

// 解析ts文件代码，获取ast，checker
exports.parseTS = function (fileName) {
  // 创建Program
  // fileNames参数表示文件路径列表，是一个数组，可以只传1个文件
  // options参数是编译选项，可以理解成tsconfig
  const program = tsCompiler.createProgram([fileName], {});
  const ast = program.getSourceFile(fileName);
  const checker = program.getTypeChecker();
  return {
    ast,
    checker,
  };
};
