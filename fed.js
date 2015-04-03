#!/usr/bin/env node

var fs = require('fs'),
    childProcess = require('child_process'),
    path = require('path'),
    dirsconf,
    map = {},
    modules = [];

/*
 Entry point read the configuration file(s)
 */
fs.readFile(path.join(__dirname, 'fed_modules.json'), 'utf8', function readGlobalModules(err, data) {
    var cwd = process.cwd();
   if (!err) {
       loadModules(data);
   }
   fs.readFile(path.join(cwd , 'fed_modules.json'), 'utf8', function readLocalModules(err1, data1) {
       var prefix = path.join(cwd, 'node_modules');
        if (!err1) {
            loadModules(data1, prefix);
        }

       // Priority commands
       modules.unshift({
           name : "__fed-priority__",
           canDo : function canDoPriority(dir, command) {
               return /^fed-(list|modules)/.test(command);
           },
           getCommand : function getCommandPriority(dir, command) {
               var argv = command.split(' '),
                   msg;
               // List all modules (only one)
               if (argv[0] === 'fed-modules') {
                   this.preventBrowse = true;
                   this.preventDefaultEcho = true;
                   this.stopIteration = true;
                   modules.forEach(function listEachModule(module) {
                       // Don't display internal modules
                       if (module.name === '__fed-priority__' ||
                           module.name === '__fed-default__') {
                           return;
                       }
                       console.log(module.name);
                   });
                   return '';
               }
               // List all directories
               if (argv[0] === "fed-list") {
                   this.preventBrowse = true;
                   this.preventDefaultEcho = true;
                   msg = dir.name;
                   if (/(-v|--verbose)/.test(command)) {
                       msg += '\n' + JSON.stringify(dir, null, 2) + '\n';
                   }
                   console.log(msg);
                   return '';
               }
               this.preventBrowse = false;
               this.preventDefaultEcho = false;
               return command;
           },
           preventBrowse : false,
           preventDefaultEcho : false,
           stopIteration : false
       });

       // Load the default modules as the fallback (at the end of the array)
       modules.push({
           name : "__fed-default__",
           canDo : function canDoDefault() {
               return true;
           },
           getCommand : function getCommandDefault(dir, command) {
               return command;
           }
       });

       // Execute the main process
       fed();
   });
});

/**
 * Load modules
 *
 * @param {String} data JSON modules definition
 * @param {String} [prefix] Prefix of modules path
 */
function loadModules(data, prefix) {
    data = JSON.parse(data);
    if (!data || !Array.isArray(data)) {
        return;
    }
    data.forEach(function loadEachModule(module) {
        var modulePath = prefix ? path.join(prefix, module.name) : module.name,
            moduleObject = require(modulePath);
        if (moduleObject &&
                typeof  moduleObject.canDo === 'function' &&
                typeof moduleObject.getCommand === 'function')  {
            modules.unshift(moduleObject);
        }
    });
}

/**
 * Main process execute the `for each directories`
 */
function fed() {
    fs.readFile(path.join(process.cwd(), '/fed.json'), 'utf8', function readFed(err, data) {
        if (err) {
            throw err;
        }
        loadDirs(data);
        executeForEach(parseCommand());
    });
}


/**
 * Execute the command data for each directories
 * @param {Object} data
 */
function executeForEach(data) {
    var i, l, j, k,
        dirs         = data.dirs,
        command      = data.command,
        directories  = [],
        dir, cmds, cmd, child, module,
        done = {};

    if (!dirs || !dirs.length) {
        directories = dirsconf.dirs;
    } else {
        for (i = 0, l = dirs.length; i < l; i += 1) {
            if (Array.isArray(map[dirs[i]])) { // Push a group
                directories.push.apply(directories, map[dirs[i]]);
            }  else {
                directories.push(map[dirs[i]]);
            }
        }
    }

    for (i = 0, l = directories.length; i < l; i += 1) {
        cmds = [];
        dir = directories[i];

        // Manage already directories that has been already proceed
        if (done[dir.name]) {
            continue;
        }
        done[dir.name] = true;



        // Search the modules that can execute the command
        for (j = 0, k = modules.length; j < k; j += 1) {
            module = modules[j];
            if (module.canDo(dir, command)) {
                cmd = module.getCommand(dir, command);
                if (!module.preventDefaultEcho) {
                    if (i) {
                        cmds.push('echo ""');
                    }
                    cmds.push('echo "On ' + dir.name + '..."');
                    cmds.push('echo ""');
                }

                if (cmd && typeof cmd === 'string') {
                    if (!module.preventBrowse) {
                        cmds.push('cd ' + dir.name);
                    }
                    cmds.push(cmd);
                    if (!module.preventBrowse) {
                        cmds.push('cd -');
                    }
                }

                break;
            }
        }

        child = childProcess.execSync(cmds.join(';'), {
            stdio : [0,1,2],
            env   : process.env
        });

        if (module.stopIteration) {
            return;
        }
    }
}

/**
 * Load the directories using .fed file data
 */
function loadDirs(data) {
    dirsconf = JSON.parse(data);
    if (!dirsconf.dirs || !Array.isArray(dirsconf.dirs)) {
        throw new Error("Require a `dirs` key as an array in the .fed file");
    }
    dirsconf.dirs.forEach(function (dir) {
        map[dir.name] = dir;
        if (dir.groups) {
            dir.groups.forEach(function (group) {
                if (!map[group]) {
                    map[group] = [];
                }
                map[group].push(dir);
            });
        }
    });
}

/**
 * Parse the command line
 * @return {Object} data Data with `dirs` and `command`
 */
function parseCommand() {
    var argv = process.argv,
        dirs = [],
        command = [], i, l,
        isCommand = false;

    for (i = 2, l = argv.length; i < l; i += 1) {
        if (!isCommand && map[argv[i]]) {
            dirs.push(argv[i]);
        } else {
            isCommand = true;
            if (/\s|;/.test(argv[i])) {
                command.push("'" + argv[i].replace(/'/gi, "\\'") + "'");
            } else {
                command.push(argv[i]);
            }
        }
    }
    return {
        dirs   : dirs,
        command : command.join(' ')
    };
}
