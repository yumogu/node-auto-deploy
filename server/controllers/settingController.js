/**
 * Created by arno
 */
var tmp = require('tmp');
var startCmd = require('../util/startCmd')
var taskListModel = require('../model/taskList')
var taskModel = require('../model/task')
var socket = require('../plugins/socket')
var obj = {
  checkGitInfo: async function (req, res, next) {
    console.log(req.body)
    var userName = req.body.userName
    var password = req.body.password
    var repositoryUrl = req.body.repositoryUrl
    if (!userName || !password || !repositoryUrl) {
      res.json({
        code: 0,
        msg: 'git 地址 用户名 密码 不能为空'
      })
      return
    }
    startCmd.addTask('getBranch', 1, req.body).then((data) => {
      console.log(data)
      let d = {
        stdout: data.stdout.split('\n').filter(d => d),
        stderr: data.stderr.split('\n').filter(d => d)
      }
      if (d.stderr.length) {
        res.json({
          code: 0,
          msg: d.stderr.join('  ')
        })
      } else {
        let arr = d.stdout.map(d => d.substr('deploy/'.length, d.length))
        res.json({
          code: 1,
          data: arr
        })
      }
    }).catch((data) => {
      res.json({
        code: 0,
        msg: data
      })
    })

  },
  taskDetail: async function (req, res, next) {
    var id = req.body.id
    if (!id && id !== 0) {
      res.json({
        code: 0,
        msg: '参数错误'
      })
      return
    }
    let d = await taskListModel.getById(id)
    res.json({
      code: 1,
      data: d
    })
  },
  addTask: async function (req, res, next) {
    var dataParams = {
      title: 'bot -dev',
      des: 'bot -dev',
      uid: 0,
      store_url: 'https://gitee.com/arno8/teacher_video.git',
      store_type: 0,
      num: 1,
      branch: 'master',
      content: {
        store_url: 'https://gitee.com/arno8/teacher_video.git',
        store_user: 'arno8',
        store_password: 'xiaochen100200',
        store_type: 0,
        branch: 'master',
        remote: 'root@118.24.156.247:22',
        remote_password: 'xiao@chen100200',
        cmd: [
          {
            des: 'npm install',
            type: 0,//本地
            cmd: 'npm install'
          },
          {
            des: 'npm run bulid',
            type: 0,//本地
            cmd: 'npm run build'
          },
          {
            des: '上传到服务器',
            type: 1,//scp
            cmd: '-scp-',
            src: './dist',
            dest: '~/dist'
          }
        ]
      }
    }
    var obj = tmp.dirSync();
    dataParams.workspace = obj.name
    dataParams.content.workspace = obj.name
    dataParams.content.start_uid = 0
    let params = {
      store_url: dataParams.content.store_url,
      store_user: dataParams.content.store_user,
      store_password: dataParams.content.store_password,
      workspace: dataParams.workspace,
      branch: dataParams.content.branch,
    }
    let data = await startCmd.addTask('init', 2, params).catch((d) => {
      res.json({
        code: 0,
        msg: d
      })
    })
    let d = {
      stdout: data.stdout.split('\n').filter(d => d),
      stderr: data.stderr.split('\n').filter(d => d)
    }
    if (d.stderr.length) {
      res.json({
        code: 0,
        msg: d.stderr.join('  ')
      })
    } else {
      dataParams.content = JSON.stringify(dataParams.content)
      let d = await taskListModel.add(dataParams).catch((d) => {
        res.json({
          code: 0,
          msg: d
        })
      })
      if (d.affectedRows > 0) {
        res.json({
          code: 1,
          data: {}
        })
      } else {
        let workspace = {
          workspace: data.workspace
        }
        startCmd.addTask('deleteDir', 3, workspace)
        res.json({
          code: 0,
          msg: '保存失败'
        })
      }

    }

  },
  startTask: async function (req, res, next) {
    var id = req.body.id
    if (!id && id !== 0) {
      res.json({
        code: 0,
        msg: '参数错误'
      })
      return
    }
    console.log(id)
    let taskObjRes = await taskListModel.getById(id)
    if (!taskObjRes) {
      res.json({
        code: 0,
        msg: '任务不存在'
      })
      return
    }
    if (taskObjRes.status === 1) {
      res.json({
        code: 0,
        msg: '任务已在执行中'
      })
      return
    }
    let addTaskObj = {
      num: taskObjRes.num + 1,
      pid: taskObjRes.id,
      store_url: taskObjRes.store_url,
      cmd: taskObjRes.content,
      workspace: taskObjRes.workspace,
      status: 0
    }
    let addTaskRes = await taskModel.add(addTaskObj)
    if (!(addTaskRes.affectedRows > 0)) {
      res.json({
        code: 0,
        msg: '系统错误'
      })
      return
    }
    await taskListModel.update({
      num: taskObjRes.num + 1,
      status: 1,
      id: taskObjRes.id
    })
    let content = JSON.parse(taskObjRes.content)
    content.title = taskObjRes.title
    content.num = taskObjRes.num + 1
    startCmd.addTask(addTaskRes.insertId, 4, content)
      .then(async (data) => {
        let obj = {
          stdout: data.stdout.split('\n').filter(d => d),
          stderr: data.stderr.split('\n').filter(d => d)
        }
        console.log(addTaskRes.insertId,'task done')
        await taskModel.updateStatus({
          status: 1,
          id: addTaskObj.insertId
        })
        await taskListModel.updateStatus({
          status: 0,
          id: taskObjRes.id
        })
      })
      .catch(async (err) => {
        console.log('error',addTaskRes.insertId,'task done')
        await taskModel.updateStatusAndLog({
          log: err,
          status: 1,
          id: addTaskObj.insertId
        })
        await taskListModel.updateStatus({
          status: 0,
          id: taskObjRes.id
        })
      })
    res.json({
      code: 1,
      data: {
        taskId: addTaskRes.insertId
      }
    })

  },
  stopTask: async function (req, res, next) {
    var id = req.body.id
    if (!id && id !== 0) {
      res.json({
        code: 0,
        msg: '参数错误'
      })
      return
    }
    socket.getWSbyTaskId(id).emit('onClose', {id})
    await taskModel.updateStopUid({uid:0, id:id})
    res.json({
      code: 1,
      data:{}
    })
  }
}

module.exports = obj