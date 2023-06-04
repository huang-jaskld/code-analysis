const path = require("path"); // 路径管理
const moment = require("moment"); // 时间格式化
const ora = require("ora"); // 命令行状态，等待、成功、失败
const chalk = require("chalk"); // 美化控制台的输出
const CodeAnalysis = require("./analysis");

const codeAnalysis = function (config) {
  return new Promise((resolve, reject) => {
    var spinner = ora(chalk.green("analysis start")).start();
    try {
      const coderTask = new CodeAnalysis(config);
      coderTask.analysis(); // 执行代码分析
      const mapNames = coderTask.pluginsQueue // 获取所有报告的名字
        .map((item) => item.mapName)
        .concat(coderTask.browserQueue.map((item) => item.mapName));

      const report = {
        importItemMap: coderTask.importItemMap,
        versionMap: coderTask.versionMap,
        parseErrorInfo: coderTask.parseErrorInfo,
        scoreMap: coderTask.scoreMap,
        reportTitle: config.reportTitle || REPORTTILE,
        anaysisTime: moment(Date.now()).format("YYYY.MM.DD HH:mm:ss"),
        mapNames,
      };
      if (mapNames.length > 0) {
        mapNames.forEach((item) => {
          report[item] = coderTask[item];
        });
      }
      console.log(report);
      resolve({
        report,
        diagnosisInfos: coderTask.diagnosisInfos,
      });
      spinner.succeed(chalk.green("analysis success"));
    } catch (e) {
      reject(e);
      spinner.fail(chalk.red("analysis fail"));
    }
  });
};

module.exports = codeAnalysis;
