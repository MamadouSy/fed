#!/usr/bin/env node

var fs = require('fs'),
    childProcess = require('child_process'),
    path = require('path'),
    osName = process.platform,
    isWindows = osName === 'win32',
    dirsconf,
    map = {},
    modules = [];


/**
 * Usage
 */
function showUsage() {
    this.preventBrowse = true;
    this.preventDefaultEcho = true;
    this.stopIteration = true;
    console.log('usage: fed [directories..] <command>');
    console.log('');
    console.log('Require a `fed.json` file at the root of the directory.');
    console.log('Execute <coammnd> for each directories listed in `fed.json`');
    console.log('');
    console.log('  [directories...]\tDirectories or groups to use');
    console.log('  When not specified, iterate on all directories');
    console.log('  <command>       \tArbitrary shell command to execute');
    console.log('');
    console.log('Special `fed` commands:');
    console.log('  fed [directories...] fed-list [-v|--verbose]\tList all directories.');
    console.log('  fed fed-modules\tList all register fed modules.');
    console.log('  fed fed-add-modules <modules...> [-g|--global]\tAdd fed modules');
    console.log('  fed fed-rm-modules <modules...> [-g|--global]\tRemove fed modules');
    return '';
}

/**
 * List all modules
 */
function listModules() {
    this.preventBrowse = true;
    this.preventDefaultEcho = true;
    this.stopIteration = true;
    if (!modules.length) {
        console.log("No fed modules registered.");
        return '';
    }
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

/**
 * List register directories
 * @param {String} command command
 * @param {Object} dir Directory
 */
function listDirectories(command, dir) {
    this.preventBrowse = true;
    this.preventDefaultEcho = true;
    var msg = dir.name;
    if (/\s(-v|--verbose)/.test(command)) {
        msg += '\n' + JSON.stringify(dir, null, 2) + '\n';
    }
    console.log(msg);
    return '';
}

/**
 * Register modules
 *
 * @param command Command
 */
function registerFedModules(command) {
    this.preventBrowse = true;
    this.preventDefaultEcho = true;
    this.stopIteration = true;
    var argv       = command.split(' '), i, l,
        isGlobal   = /\s(-g|--global)/.test(command),
        modulePath = path.join((isGlobal) ? __dirname : process.cwd(), 'fed_modules.json'),
        moduleJson,
        registeredModules = {},
        added = [];

    try {
        moduleJson = fs.readFileSync(modulePath, 'utf8');
    } catch (err) {
        moduleJson = '[]';
    }
    moduleJson = JSON.parse(moduleJson);
    for (i = 0, l = moduleJson.length; i < l; i += 1) {
        registeredModules[moduleJson[i].name] = true;
    }

    for (i = 1, l = argv.length; i < l; i += 1) {
        if (!/^-/.test(argv[i])) { // not an option
            if (!registeredModules[argv[i]]) {
                moduleJson.push({
                    name : argv[i]
                });
                added.push(argv[i]);
                registeredModules[argv[i]] = true
            }
        }
    }

    if (added.length) {
        fs.writeFileSync(modulePath, JSON.stringify(moduleJson), 'utf8');
        console.log('Fed modules: "' + added.join(', ') + '" added.');
    } else {
        console.warn('No module to add');
    }

    return '';
}

/**
 * Unregister modules
 *
 * @param command Command
 */
function unregisterFedModules(command) {
    this.preventBrowse = true;
    this.preventDefaultEcho = true;
    this.stopIteration = true;
    var argv       = command.split(' '), i, l,
        isGlobal   = /\s(-g|--global)/.test(command),
        modulePath = path.join((isGlobal) ? __dirname : process.cwd(), 'fed_modules.json'),
        moduleJson,
        cleanModuleJson = [],
        removed = [];

    try {
        moduleJson = fs.readFileSync(modulePath, 'utf8');
    } catch (err) {
        console.log('No modules found.');
        return '';
    }
    moduleJson = JSON.parse(moduleJson);

    moduleJson.forEach(function forEachModules(module) {
        for (i = 1, l = argv.length; i < l; i += 1) {
            if (module.name !== argv[i]) {
                cleanModuleJson.push(module);
            } else {
                removed.push(argv[i]);
            }
        }
    });


    if (removed.length) {
        fs.writeFileSync(modulePath, JSON.stringify(cleanModuleJson), 'utf8');
        console.log('Fed modules: "' + removed.join(', ') + '" removed.');
    } else {
        console.warn('No module to remove');
    }

    return '';
}


/**
 * Add special fed commands
 * (Priority internal fed modules)
 */
function addFedCommands() {
    modules.unshift({
        name : "__fed-priority__",
        canDo : function canDoPriority(command) {
            if (!command) {
                return true;
            }
            return /^fed-(list|modules|add\-modules|rm\-modules)/.test(command);
        },
        getCommand : function getCommandPriority(command, dir) {
            var argv = command.split(' ');
            if (command.trim() === '') {
                return showUsage.call(this);
            }

            switch (argv[0]) {
                case 'fed-modules':
                    return listModules.call(this);
                case 'fed-add-modules' :
                    return registerFedModules.apply(this, arguments);
                case 'fed-rm-modules':
                    return unregisterFedModules.apply(this, arguments);
                case 'fed-list':
                    return listDirectories.apply(this, arguments);
                default:
                    this.preventBrowse = false;
                    this.preventDefaultEcho = false;
                    return command;
            }
        },
        preventBrowse : false,
        preventDefaultEcho : false,
        stopIteration : false
    });
}

/**
 * Add default fed commands
 */
function addDefaultCommand() {
    modules.push({
        name : "__fed-default__",
        canDo : function canDoDefault() {
            return true;
        },
        getCommand : function getCommandDefault(command, dir) {
            return command;
        }
    });
}

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
       addFedCommands();

       // Load the default modules as the fallback (at the end of the array)
       addDefaultCommand();

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
            moduleObject;
        try {
            moduleObject = require(modulePath);
        } catch(err) {
            moduleObject = null;
            console.warn("WARNING: " + err.message);
        }

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
            modules = [];
            addFedCommands();
            var cmdLine = parseCommand();
            if (modules[0].canDo(cmdLine.command, cmdLine.dir)) {
                return modules[0].getCommand(cmdLine.command, cmdLine.dir);
            }
            return showUsage.call({});
        }
        loadDirs(data);
        executeForEach(parseCommand());
    });
}

function execute(command, dirName, preventBrowse) {
    var options = {
        stdio : [0,1,2],
        env   : process.env
    };
    if (!preventBrowse) {
        options.cwd = path.join(process.cwd(), dirName);
    } else {
        options.cwd = process.cwd();
    }
    childProcess.execSync(command, options);
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
        dir, cmds, cmd, module,
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
            if (module.canDo(command, dir)) {
                cmd = module.getCommand(command, dir);
                if (!module.preventDefaultEcho) {
                    if (i) {
                        if (!isWindows) {
                            cmds.push('echo ""');
                        } else {
                            console.log("");
                            console.log("");
                        }
                    }
                    if (!isWindows) {
                         cmds.push('echo "On ' + dir.name + '..."');
                    }
                    else {
                        console.log('On ' + dir.name + '...');
                        console.log('-------------------------------------------');
                    }
                }

                if (cmd && typeof cmd === 'string') {
                    if (!module.preventBrowse && !isWindows) {
                        cmds.push('cd ' + dir.name);
                    }
                    if (!isWindows) {
                         cmds.push(cmd);
                    } else {
                        execute(cmd, dir.name, module.preventBrowse);
                    }
                    if (!module.preventBrowse && !isWindows) {
                        cmds.push('cd -');
                    }
                }

                break;
            }
        }

        if (!isWindows) {
            childProcess.execSync(cmds.join(';'), {
                stdio : [0,1,2],
                env   : process.env
            });
        }

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
