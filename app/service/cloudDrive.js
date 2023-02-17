const Service = require("egg").Service;
const _ = require("lodash");
const validateUtil = require("@jianghujs/jianghu/app/common/validateUtil");
const fileUtil = require('@jianghujs/jianghu/app/common/fileUtil');
const {BizError, errorInfoEnum} = require("../constant/error");
const dayjs = require("dayjs");
const fs = require("fs");
const os = require("os"),
  nodePath = require("path"),
  fsPromises = require("fs").promises,
  readdir = fsPromises.readdir,
  stat = fsPromises.stat,
  rename = fsPromises.rename,
  unlink = fsPromises.unlink,
  lstat = fsPromises.lstat,
  util = require("util"),
  rimraf = util.promisify(require("rimraf")),
  exists = util.promisify(fs.exists),
  copyFile = util.promisify(fs.copyFile);
const {tableEnum} = require("../constant/constant");
const path = require("path");

const actionDataScheme = Object.freeze({
  getUserCloudDriveList: {
    type: "object",
    additionalProperties: true,
    required: [],
    properties: {
    },
  },
  list: {
    type: "object",
    additionalProperties: true,
    required: ["path"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  mkdir: {
    type: "object",
    additionalProperties: true,
    required: ["path"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  moveFile: {
    type: "object",
    additionalProperties: true,
    required: ["fromDir", "toDir", "filename"],
    properties: {
      fromDir: {anyOf: [{type: "string"}, {type: "number"}]},
      toDir: {anyOf: [{type: "string"}, {type: "number"}]},
      filename: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  copyFile: {
    type: "object",
    additionalProperties: true,
    required: ["fromDir", "toDir", "filename"],
    properties: {
      fromDir: {anyOf: [{type: "string"}, {type: "number"}]},
      toDir: {anyOf: [{type: "string"}, {type: "number"}]},
      filename: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  renameFile: {
    type: "object",
    additionalProperties: true,
    required: ["path", "newFilename"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
      newFilename: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  clearRecycle: {
    type: "object",
    additionalProperties: true,
    required: ["path"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  getMarkdownContent: {
    type: "object",
    additionalProperties: true,
    required: ["path"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  saveMarkdown: {
    type: "object",
    additionalProperties: true,
    required: ["content", "path", "name"],
    properties: {
      name: {anyOf: [{type: "string"}, {type: "number"}]},
      content: {anyOf: [{type: "string"}, {type: "number"}]},
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
  delete: {
    type: "object",
    additionalProperties: true,
    required: ["path"],
    properties: {
      path: {anyOf: [{type: "string"}, {type: "number"}]},
    },
  },
});

function pathCheck(path) {
  if (path.indexOf("../") > -1) {
    throw new BizError(errorInfoEnum.path_invalid);
  }
  if (path.endsWith("..")) {
    throw new BizError(errorInfoEnum.path_invalid);
  }
}

class CloudDriveService extends Service {

  async getUserCloudDriveList() {
    const { actionData } = this.ctx.request.body.appData;
    const { jianghuKnex, config } = this.app;
    const { userInfo } = this.ctx;
    const { userId } = userInfo;
    validateUtil.validate(actionDataScheme.getUserCloudDriveList, actionData);
    const cloudDriveList = [{
      groupId: "cloudDemo"
    }];
    return {
      rows: cloudDriveList
    };
  }

  async checkStorage(groupStorage) {
    const {config} = this.app;
    const {uploadDir} = config;
    const cloudDrive = 'cloudDrive';
    const upload = nodePath.join(uploadDir);
    // 网盘根目录
    const targetPath = nodePath.join(upload, cloudDrive);
    if(!await exists(targetPath)) {
      await fsPromises.mkdir(targetPath, {recursive: true});
    }
    // 班级目录
    const groupPath = nodePath.join(targetPath, groupStorage);
    if(!await exists(groupPath)) {
      await fsPromises.mkdir(groupPath, {recursive: true});
    }
    // 班级的回收站目录
    const _recyclePath = nodePath.join(targetPath, groupStorage + '/_recycle');
    if(!await exists(_recyclePath)) {
      await fsPromises.mkdir(_recyclePath, {recursive: true});
    }
    return true;
  }

  async list() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.list, actionData);
    const {cloudDriveDir} = this.app.config;
    let {path} = actionData;
    if(path !== '/') {
      await this.checkStorage(path.substring(1).split('/')[0]);
    }
    pathCheck(path);

    const userCloudDriveList = await this.getUserCloudDriveList()
    // 权限检查
    if(path !== '/'){
      const paths = path.split('/')
      const hasPath = userCloudDriveList.rows.some(group => paths[1] === group.groupId)
      if(!hasPath){
        throw new BizError(errorInfoEnum.path_no_permissions);
      }
    }

    let dirs = [],
      files = [];

    if (path[path.length - 1] !== "/") {
      path += "/";
    }

    const targetPath = nodePath.join(cloudDriveDir, path);
    let items = await readdir(targetPath, {
      withFileTypes: true,
    });

    for (let item of items) {
      let isFile = item.isFile(),
        isDir = item.isDirectory();

      if (!isFile && !isDir) {
        continue;
      }

      let result = {
        type: isFile ? "file" : "dir",
        path: path + item.name,
      };

      result.basename = result.name = nodePath.basename(result.path);

      if (isFile) {
        let fileStat = await stat(nodePath.join(cloudDriveDir, result.path));
        result.size = fileStat.size;
        result.extension = nodePath.extname(result.path).slice(1);
        result.name = nodePath.basename(
          result.path,
          "." + result.extension
        );
        result.mtime = dayjs(fileStat.mtime).unix();
        files.push(result);
      } else {
        result.path += "/";
        dirs.push(result);
      }
    }

    let rows = dirs.concat(files);
    // 过滤无权限数据
    if(path === '/'){
      rows = rows.filter(d => userCloudDriveList.rows.some(group => d.name === group.groupId))
    }

    return {rows};
  }

  async mkdir() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.mkdir, actionData);
    const {cloudDriveDir} = this.app.config;
    const {path} = actionData;
    pathCheck(path);
    const targetPath = nodePath.join(cloudDriveDir, path);
    await fsPromises.mkdir(targetPath, {recursive: true});
  }

  async copyFile() {
    const actionData = this.ctx.request.body.appData.actionData;
    const {cloudDriveDir} = this.app.config;
    validateUtil.validate(actionDataScheme.copyFile, actionData);
    const {fromDir, toDir, filename} = actionData
    pathCheck(fromDir);
    pathCheck(toDir);
    const fromPath = nodePath.join(cloudDriveDir, fromDir, filename);
    const toPath = nodePath.join(cloudDriveDir, toDir, filename);
    if (!await exists(fromPath)) {
      throw new BizError(errorInfoEnum.target_file_not_exist);
    }
    await copyFile(fromPath, toPath);
  }

  async moveFile() {
    const actionData = this.ctx.request.body.appData.actionData;
    const {cloudDriveDir} = this.app.config;
    validateUtil.validate(actionDataScheme.moveFile, actionData);
    const {fromDir, toDir, filename} = actionData;
    pathCheck(fromDir);
    pathCheck(toDir);
    const fromPath = nodePath.join(cloudDriveDir, fromDir, filename);
    const toPath = nodePath.join(cloudDriveDir, toDir, filename);
    if (!await exists(fromPath)) {
      throw new BizError(errorInfoEnum.target_file_not_exist);
    }
    await rename(fromPath, toPath);
  }

  async renameFile() {
    const actionData = this.ctx.request.body.appData.actionData;
    const {cloudDriveDir} = this.app.config;
    validateUtil.validate(actionDataScheme.renameFile, actionData);
    const {path, newFilename} = actionData;
    pathCheck(path);
    const targetPath = nodePath.join(cloudDriveDir, path);
    const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/') + 1);
    const newFilenamePath = nodePath.join(targetDir, newFilename);

    const isFileExists = await exists(targetPath);
    if (!isFileExists) {
      throw new BizError(errorInfoEnum.target_file_not_exist);
    }
    await rename(targetPath, newFilenamePath);
  }

  async delete() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.delete, actionData);
    const {cloudDriveDir} = this.app.config;
    const {path} = actionData;
    pathCheck(path);
    const targetPath = nodePath.join(cloudDriveDir, path);
    const groupStorage = path.substring(1, path.indexOf('/', 1));

    let stat = await lstat(targetPath),
      isDir = stat.isDirectory(),
      isFile = stat.isFile();
    if (isFile) {
      if (path.includes('/_recycle/')) {
        await unlink(targetPath);
        return
      }
      const filename = path.substring(path.lastIndexOf('/') + 1);
      const recycleFilePath = nodePath.join(cloudDriveDir, groupStorage, '_recycle', filename);
      await rename(targetPath, recycleFilePath);
    } else if (isDir) {
      let tempPath = path;
      if (tempPath.endsWith("/")) {
        tempPath = tempPath.substring(0, path.length - 1);
      }
      const dirname = tempPath.substring(tempPath.lastIndexOf('/') + 1);
      const recycleDirPath = nodePath.join(cloudDriveDir, groupStorage, '_recycle', dirname);
      await rename(targetPath, recycleDirPath);
    }
  }

  async clearRecycle() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.clearRecycle, actionData);
    const {path} = actionData;
    const groupStorage = path.substring(1, path.indexOf('/') + 1);
    const {cloudDriveDir} = this.app.config;
    const targetPath = nodePath.join(cloudDriveDir, groupStorage, '_recycle', '/');
    await rimraf(targetPath);
  }

  async saveMarkdown() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.saveMarkdown, actionData);
    const {content, path, name} = actionData;
    const {cloudDriveDir} = this.app.config;
    const { userInfo } = this.ctx;
    const { userId } = userInfo;
    const targetPath = nodePath.join(cloudDriveDir, path);
    const groupStorage = path.substring(1, path.indexOf('/', 1));
    const recycleBackupsPath = nodePath.join(cloudDriveDir, groupStorage, '_recycle', `${+new Date()}_${userId}_${name}.md`);
    const mdFile = nodePath.join(targetPath, `/${name}.md`);
    // 保留一份备份在recycle
    if (await exists(mdFile)) {
      await rename(mdFile, recycleBackupsPath);
    }
    await fsPromises.writeFile(mdFile, content);
  }

  async getMarkdownContent() {
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.getMarkdownContent, actionData);
    const {path} = actionData;
    const {cloudDriveDir} = this.app.config;
    const targetPath = nodePath.join(cloudDriveDir, path);
    const resultData = await fsPromises.readFile(targetPath, 'utf-8');
    return {
      mdContent: resultData
    };
  }

}

module.exports = CloudDriveService;
