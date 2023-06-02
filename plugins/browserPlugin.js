exports.browserPlugin = function (analysisContext) {
  const mapName = "browserMap";

  analysisContext[mapName] = {};

  function isBrowserCheck(
    context,
    tsCompiler,
    node,
    depth,
    apiName,
    filePath,
    projectName,
    httpRepo,
    line
  ) {
    try {
      if (!context[mapName][apiName]) {
        context[mapName][apiName] = {};
        context[mapName][apiName].callNum = 1;
        context[mapName][apiName].callOrigin = matchImportItem.callOrigin;
        context[mapName][apiName].callFiles = {};
        context[mapName][apiName].callFiles[filePath] = {};
        context[mapName][apiName].callFiles[filePath].projectName = projectName;
        context[mapName][apiName].callFiles[filePath].httpRepo = httpRepo;
        context[mapName][apiName].callFiles[filePath].lines = [];
        context[mapName][apiName].callFiles[filePath].lines.push(line);
      } else {
        context[mapName][apiName].callNum++;
        if (
          !Object.keys(context[mapName][apiName].callFiles).includes(filePath)
        ) {
          context[mapName][apiName].callFiles[filePath] = {};
          context[mapName][apiName].callFiles[filePath].projectName =
            projectName;
          context[mapName][apiName].callFiles[filePath].httpRepo = httpRepo;
          context[mapName][apiName].callFiles[filePath].lines = [];
          context[mapName][apiName].callFiles[filePath].lines.push(line);
        } else {
          context[mapName][apiName].callFiles[filePath].lines.push(line);
        }
      }
      return true; // 命中规则，终止执行后续插件
    } catch (e) {
      const info = {
        projectName: projectName,
        apiName: apiName,
        httpRepo: httpRepo + filePath.split("&")[1] + "#L" + line,
        file: filePath.split("&")[1],
        line: line,
        stack: e.stack,
      };
      context.addDiagnosisInfo(info);
      return false;
    }
  }

  return {
    mapName,
    checkFun: isBrowserCheck,
    afterHook: null,
  };
};
