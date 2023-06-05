exports.anyTypePlugin = function (analysisContext) {
  const mapName = "anyTypeMap";
  // 在分析实例上下文挂载副作用
  analysisContext[mapName] = {};

  function isAnyTypeCheck(
    context,
    tsCompiler,
    checker,
    node,
    depth,
    apiName,
    filePath,
    projectName,
    httpRepo,
    line
  ) {
    // console.log(checker.getTypeAtLocation(node).intrinsicName);
    // tsCompiler.SyntaxKind;
    try {
      if (node.kind === tsCompiler.SyntaxKind.AnyKeyword) {
        let fullCode = context._getFullCode(tsCompiler, node);
        if (!context[mapName][filePath]) {
          context[mapName][filePath] = [];
          let temp = {};
          temp.code = fullCode;
          temp.line = line;
          temp.filePath = filePath;
          temp.pos = node.pos;
          temp.end = node.end;
          context[mapName][filePath].push(temp);
        } else {
          let temp = {};
          temp.code = fullCode;
          temp.line = line;
          temp.filePath = filePath;
          temp.pos = node.pos;
          temp.end = node.end;
          context[mapName][filePath].push(temp);
        }
      }
    } catch (e) {
      console.log(e);
    }
    return false;
  }

  return {
    mapName: mapName,
    checkFun: isAnyTypeCheck,
    afterHook: null,
  };
};
