const path = require("path"); // 路径处理
const tsCompiler = require("typescript"); // TS编译器
const chalk = require("chalk"); // 美化输出
const processLog = require("single-line-log"); // 单行输出，多用于进度条
const { ifError, notDeepStrictEqual } = require("assert");
const { scanFileTs, scanFileVue, getJsonContent } = require(path.join(
  __dirname,
  "./file"
)); // 读写模块
const { CODEFILETYPE } = require(path.join(__dirname, "./constant")); // 常量模块
const { parseTS } = require(path.join(__dirname, "./parse"));

class CodeAnalysis {
  constructor(options) {
    // 私有属性
    this._scanSource = options.scanSource; // 扫描源配置信息
    this._analysisTarget = options.analysisTarget || []; // 要分析的目标依赖配置
    this._blackList = options.blackList || []; // 需要标记的黑名单API配置
    this._browserApis = options.browserApis || []; // 需要分析的BrowserApi配置
    this._isScanVue = options.isScanVue || false; // 是否扫描Vue配置
    this._scorePlugin = options.scorePlugin || null; // 代码评分插件配置
    this._analysisPlugins = options.analysisPlugins || []; // 代码分析插件配置
    // 公共属性
    this.pluginsQueue = []; // Targer分析插件队列
    this.browserQueue = []; // Browser分析插件队列
    this.importItemMap = {}; // importItem统计Map
  }

  // 注册插件
  _installPlugins(plugins) {
    if (plugins.length) {
      plugins.forEach((item) => {
        // 注册自定义插件
        this.pluginsQueue.push(item(this));
      });
    }
    this.pluginsQueue.push(methodPlugin(this)); // 注册方法分析插件
    this.pluginsQueue.push(typePlugin(this)); // 注册类型分析插件
    this.pluginsQueue.push(defaultPlugin(this)); // 注册默认导入插件
    if (this._browserApis.length > 0) {
      this.browserQueue.push(browserPlugin(this)); // 注册全局对象分析插件
    }
  }

  /**
   * 扫描文件
   * @param {*} scanSource 扫描源配置信息
   * @param {*} type 文件类型
   */
  _scanFiles(scanSource, type) {
    let entrys = [];
    scanSource.forEach((item) => {
      const entryObj = {
        name: item.name,
        httpRepo: item.httpRepo,
      };

      let parse = [];
      let show = [];
      const scanPath = item.path;
      // scanPath 为 ["src"]之类的数据
      scanPath.forEach((sitem) => {
        let tempEntry = [];
        // 扫描目录下的指定类型文件
        if (type === CODEFILETYPE.VUE) {
          tempEntry = scanFileVue(sitem);
        } else if (type === CODEFILETYPE.TS) {
          tempEntry = scanFileTs(sitem);
        }

        // 文件路径格式化，默认为null，一般不配置
        let tempPath = tempEntry.map((titem) => {
          if (item.format && typeof item.format === "function") {
            return item.format(titem.substring(titem.indexOf(sitem)));
          } else {
            return titem.substring(titem.indexOf(sitem));
          }
        });

        parse = parse.concat(tempEntry);
        show = show.concat(tempPath);
      });
      entryObj.parse = parse;
      entryObj.show = show;
      entrys.push(entryObj);
    });
    return entrys;
  }

  // 扫描代码生成AST及
  _scanCode(scanSource, type) {
    const entrys = this._scanFiles(scanSource, type);

    entrys.forEach((item) => {
      // 获取需要扫描的文件路径
      const parseFiles = item.parse;
      if (parseFiles.length) {
        parseFiles.forEach((element, eIndex) => {
          const showPath = item.name + "&" + item.show[eIndex];
          try {
            if (type === CODEFILETYPE.TS) {
              const { ast, checker } = parseTS(element); // 获取到单文件中的AST树
              const importItems = this._findImportItems(ast, showPath); // 从import语句中获取导入的需要分析的目标API
              if (
                Object.keys(importItems).length > 0 ||
                this._browserApis.length > 0
              ) {
                this._dealAST(
                  importItems,
                  ast,
                  checker,
                  showPath,
                  item.name,
                  item.httpRepo
                ); // 递归分析AST，统计相关信息
              }
            }
          } catch (e) {}
        });
      }
    });
  }

  /**
   * 分析导入依赖
   * @param {*} ast AST树
   * @param {*} filePath 文件路径
   * @param {*} baseLine  所在行
   * @returns
   */
  _findImportItems(ast, filePath, baseLine = 0) {
    let importItems = {}; // 用于存储信息
    let that = this;

    function dealImports(temp) {
      importItems[temp.name] = {};
      importItems[temp.name].origin = temp.origin;
      importItems[temp.name].symbolPos = temp.symbolPos;
      importItems[temp.name].symbolEnd = temp.symbolEnd;
      importItems[temp.name].identifierPos = temp.identifierPos;
      importItems[temp.name].identifierEnd = temp.identifierEnd;

      if (!that.importItemMap[temp.name]) {
        that.importItemMap[temp.name] = {};
        that.importItemMap[temp.name].callOrigin = temp.origin;
        that.importItemMap[temp.name].callFiles = [];
        that.importItemMap[temp.name].callFiles.push(filePath);
      } else {
        that.importItemMap[temp.name].callFiles.push(filePath);
      }
    }

    // 遍历AST寻找import节点
    function walk(node) {
      tsCompiler.forEachChild(node, walk); // 遍历节点
      // 根据节点信息进行处理
      const line =
        ast.getLineAndCharacterOfPosition(node.getStart()).line + baseLine + 1; // 获取到节点所在的行

      // 判断该节点是否是导入声明

      if (tsCompiler.isImportDeclaration(node)) {
        // 通过判断节点的 `moduleSpecifier.text` 属性是否为分析目标
        if (
          node.moduleSpecifier &&
          node.moduleSpecifier.text &&
          that._analysisTarget.includes(node.moduleSpecifier.text) // 是否在需要分析的依赖数组中
        ) {
          // 存在导入项 —— import orm(导入项) from "orm"
          // import * from "orm"
          if (node.importClause) {
            // default直接导入
            if (node.importClause.name) {
              let temp = {
                name: node.importClause.name.escapedText,
                origin: null, // 从目标依赖导出的 API 本名，null 表示非别名导入，不需映射
                symbolPos: node.importClause.pos,
                symbolEnd: node.importClause.end,
                identifierPos: node.importClause.name.pos, // 两个索引位置也是为了后续步骤在分析节点时做唯一性判定
                identifierEnd: node.importClause.name.end,
                line: line,
              };
              dealImports(temp);
            }
            // 别名导入 import { request as req } from 'framework';
            if (node.importClause.namedBindings) {
              // 扩展引入场景，包含as情况
              if (tsCompiler.isNamedImports(node.importClause.namedBindings)) {
                if (
                  node.importClause.namedBindings.elements &&
                  node.importClause.namedBindings.elements.length > 0
                ) {
                  const tempArr = node.importClause.namedBindings.elements;
                  tempArr.forEach((element) => {
                    if (tsCompiler.isImportSpecifier(element)) {
                      let temp = {
                        name: element.name.escapedText,
                        origin: element.propertyName
                          ? element.escapedText
                          : null,
                        symbolPos: element.pos,
                        symbolEnd: element.end,
                        identifierPos: element.name.pos,
                        identifierEnd: element.name.end,
                        line: line,
                      };
                      dealImports(temp);
                    }
                  });
                }
              }
              // * 全量导入as场景
              if (
                tsCompiler.isNamespaceImport(node.importClause.namedBindings) &&
                node.importClause.namedBindings.name
              ) {
                let temp = {
                  name: node.importClause.namedBindings.name.escapedText,
                  origin: "*",
                  symbolPos: node.importClause.namedBindings.pos,
                  symbolEnd: node.importClause.namedBindings.end,
                  identifierPos: node.importClause.namedBindings.name.pos,
                  identifierEnd: node.importClause.namedBindings.name.end,
                  line: line,
                };
                dealImports(temp);
              }
            }
          }
        }
      }
    }

    walk(ast);

    return importItems;
  }

  // AST分析
  _dealAST(
    importItems,
    ast,
    checker,
    filePath,
    projectName,
    httpRepo,
    baseLine = 0
  ) {
    const that = this;
    const importItemNames = Object.keys(importItems);
    // console.log("importItemNames", importItemNames); // ['ora','path']

    function walk(node) {
      tsCompiler.forEachChild(node, walk);
      const line =
        ast.getLineAndCharacterOfPosition(node.getStart()).line + baseLine + 1; // 获取节点所在行
      if (
        tsCompiler.isIdentifier(node) &&
        node.escapedText &&
        importItemNames.length > 0 &&
        importItemNames.includes(node.escapedText)
      ) {
        // 命中Target Api Item Name
        const matchImportItem = importItems[node.escapedText];
        // 排除importItem Node 自身
        if (
          matchImportItem.identifierPos !== node.pos &&
          matchImportItem.identifierEnd !== node.end
        ) {
          const symbol = checker.getSymbolAtLocation(node);
          if (symbol && symbol.declarations && symbol.declarations.length > 0) {
            const nodeSymbol = symbol.declarations[0];
            //存在上下文声明
            if (
              matchImportItem.symbolPos === nodeSymbol.pos &&
              matchImportItem.symbolEnd === nodeSymbol.end
            ) {
              // 上下文什么与import item匹配，符合API调用
              if (node.parent) {
                const { baseNode, depth, apiName } =
                  that._checkPropertyAccess(node); // 获取基础分析节点信息
                that._runAnalysisPlugins(
                  tsCompiler,
                  baseNode,
                  depth,
                  apiName,
                  matchImportItem,
                  filePath,
                  projectName,
                  httpRepo,
                  line
                ); // 执行分析插件
              } else {
                // Identifier节点如果没有parent属性，说明AST节点语义异常，不存在分析意义
              }
            } else {
              // 上下文非importItem API但与其同名的Identifier节点
            }
          }
        }
      }
    }

    walk(ast);
  }

  // 链式调用检查，找到来链路顶点node
  _checkPropertyAccess(node, index = 0, apiName = "") {
    if (index > 0) {
      apiName += "." + node.name.escapedText;
    } else {
      apiName += node.escapedText;
    }

    if (tsCompiler.isPropertyAccessExpression(node.parent)) {
      index++;
      return this._checkPropertyAccess(node.parent, index, apiName);
    } else {
      return {
        baseNode: node,
        depth: index,
        apiName: apiName,
      };
    }
  }

  // 执行Target分析插件队列中的checkFun函数
  _runAnalysisPlugins(
    tsCompiler,
    baseNode,
    depth,
    apiName,
    matchImportItem,
    filePath,
    projectName,
    httpRepo,
    line
  ) {
    if (this.pluginsQueue.length > 0) {
      for (let i = 0; i < this.pluginsQueue.length; i++) {
        const checkFun = this.pluginsQueue[i].checkFun;
        if (
          checkFun(
            this,
            tsCompiler,
            baseNode,
            depth,
            apiName,
            matchImportItem,
            filePath,
            projectName,
            httpRepo,
            line
          )
        ) {
          break;
        }
      }
    }
  }

  // 入口函数
  analysis() {
    // 注册插件
    // this._installPlugins(this._analysisPlugins);

    // 扫描分析Vue
    if (this._isScanVue) {
      this._scanCode(this._scanSource, CODEFILETYPE.VUE);
    }
    // 扫描分析TS
    this._scanCode(this._scanSource, CODEFILETYPE.TS);
  }
}

module.exports = CodeAnalysis;
