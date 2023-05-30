const fs = require("fs"); // 文件操作
const path = require("path"); // 路径
const glob = require("glob"); // 文件扫描工具

// 输出内容到JSON文件
function writeJsonFile(content, fileName) {
  try {
    fs.writeFileSync(
      path.join(process.cwd(), `${fileName}.json`),
      JSON.stringify(content),
      "utf8"
    );
  } catch (e) {
    throw e;
  }
}

// 输出内容到JS文件
function writeJsFile(prc, content, fileName) {
  try {
    fs.writeFileSync(
      path.join(process.cwd(), `${fileName}.js`),
      prc + JSON.stringify(content),
      "utf8"
    );
  } catch (e) {
    throw e;
  }
}

// 输出内容到TS文件
function writeTsFile(content, fileName) {
  try {
    fs.writeFileSync(
      path.join(process.cwd(), `${fileName}.ts`),
      content,
      "utf8"
    );
  } catch (e) {
    throw e;
  }
}

// 扫描TS文件
function scanFileTs(scanPath) {
  const tsFiles = glob.sync(path.join(process.cwd(), `${scanPath}/**/*.ts`));
  const tsxFiles = glob.sync(path.join(process.cwd(), `${scanPath}/**/*.tsx`));
  return tsFiles.concat(tsxFiles);
}

// 获取代码文件内容
function getCode(fileName) {
  try {
    const code = fs.readFileSync(fileName, "utf-8");
    return code;
  } catch (e) {
    throw e;
  }
}

// 获取JSON文件内容
function getJsonContent(fileName) {
  try {
    const content = JSON.parse(
      fs.readFileSync(`${path.join(process.cwd(), fileName)}`, "utf-8")
    );
    return content;
  } catch (e) {
    throw e;
  }
}

// 创建目录
function mkDir(dirName) {
  const dirPath = path.join(process.cwd(), `./${dirName}`);
  if (fs.existsSync(dirPath)) {
    console.warn(`${dirName}文件目录已经创建`);
    return;
  }
  try {
    fs.mkdirSync(mkDir, 0777);
  } catch (e) {
    throw e;
  }
}

// 删除指定目录及目录下所有文件
function rmDir(dirName) {
  try {
    const dirPath = path.join(process.cwd(), `./${dirName}`);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      // 删除子文件
      files.forEach((file) => {
        let curPath = path.join(dirName, file);
        if (fs.statSync(curPath).isDirectory()) {
          rmDir(curPath); // 如果是一个文件夹，那么就递归删除
        } else {
          fs.unlinkSync(path.join(process.cwd(), curPath)); // 删除文件
        }
      });
      // 删除文件夹
      fs.rmdirSync(dirPath);
    }
  } catch (e) {
    throw e;
  }
}

module.exports = {
  writeJsonFile,
  writeJsFile,
  writeTsFile,
  scanFileTs,
  getCode,
  getJsonContent,
  rmDir,
  mkDir,
};
