var sshPool = require('../ssh-pool/index')
var logger = require("./log4j");

var tmp = require('tmp');
// var Connection  = sshPool.Connection
// const connection = new Connection({
//   remote: 'root@118.24.156.247:22',
//   password:'xiao@chen100200',
//   log: (...args) => console.log(...args),
// })
var exec = sshPool.exec


module.exports = {
  createWorkspace() {
    var obj = tmp.dirSync();
    // console.log('Dir: ', tmpobj.name);
    // Manual cleanup
    // tmpobj.removeCallback();
    return obj
  },
  async initRepository(workspace) {
    logger.info('Initialize local repository in "%s"', workspace);
    var cmd = 'git init'
    let res = exec(
      cmd,
      {
        cwd: workspace
      }
    ).catch(({stderr, stdout}) => console.error('error', stderr))
    logger.info('Repository initialized.');
    return res
  },
  addRemote(workspace, repositoryUrl, userName, password) {
    return new Promise((resolve, reject) => {
      logger.info('List local remotes.');
      exec('git remote', {
        cwd: workspace
      }).then((res) => {
        const remotes = res.stdout ? res.stdout.split(/\s/) : [];
        const method = remotes.indexOf('deploy') !== -1 ? 'set-url' : 'add';
        logger.info('Update remote "%s" to local repository "%s"', repositoryUrl, workspace); // Update remote.
        let strAr = repositoryUrl.split('//')

        let urlAr = []
        if (strAr.length === 2) {
          urlAr.push(strAr[0])
          urlAr.push('//')
          if (userName && password) {
            urlAr.push(encodeURIComponent(userName))
            urlAr.push(':')
            urlAr.push(encodeURIComponent(password))
            urlAr.push('@')
          }
          urlAr.push(strAr[1])
        } else {
          reject({
            code: 0,
            msg: 'git 地址不正确'
          })
        }
        let url = urlAr.join('')
        // logger.info('Update remote "%s" to local repository "%s"', url, workspace); // Update remote.
        exec(`git remote ${method} deploy ${url}`, {
          cwd: workspace
        }).then((res) => resolve(res))
          .catch(({stderr, stdout}) => console.error(stderr));
        logger.info('Remote updated.');

      })
        .catch(({stderr, stdout}) => {
          logger.error(stderr)
          console.error(stderr)
        });
    })

  },
  async fetch(workspace, repositoryUrl, shallowClone) {
    let fetchCommand = 'git fetch deploy --prune';
    const fetchDepth = shallowClone ? ' --depth=1' : ''; // fetch branches and tags separate to be compatible with git versions < 1.9

    fetchCommand += `${fetchDepth} && ${fetchCommand} "refs/tags/*:refs/tags/*"`;
    logger.info('Fetching repository "%s" start', repositoryUrl);
    let res = await exec(fetchCommand, {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('Repository fetched.');
    return res
  },
  async branchList(workspace, repositoryUrl) {
    let fetchCommand = 'git branch -r';
    logger.info('"%s" branchList start', repositoryUrl);
    let res = await exec(fetchCommand, {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('"%s" branchList end.', repositoryUrl);
    let data = res.stdout ? res.stdout.split(/\s/) : [];
    return data.filter(d => d).join('\n');
  },

  async checkout(branch, workspace) {
    logger.info('Checking out commit-ish "%s"', branch);
    let res = await exec(`git checkout ${branch}`, {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('Checked out.');
    return res
  },
  async pull(branch, workspace) {
    logger.info('pull start');
    let res = await exec(`git pull deploy ${branch}`, {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('pull end');
    return res
  },
  async updateSubmodules(workspace) {
    logger.info('Updating submodules.');
    let res = await exec('git submodule update --init --recursive', {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('Submodules updated');
    return res
  },
  async history(workspace) {
    logger.info('git log start');
    let res = await exec('git log --pretty=format:"%h-- %an--%ad--%s"', {
      cwd: workspace
    }).catch(({stderr, stdout}) => {
      logger.error(stderr)
      console.error(stderr)
    });
    logger.info('git log end');
    return res
  }
}

// let tmpobj = task.createWorkspace()
// console.log(tmpobj)

// task.branchList('/Users/arno/code/newwork/shipit/testgit', 'test').then((d) => console.log(d))

