# For Each Directories (fed)

This developers tools allows to execute an arbitrary shell command for each directories
listed in the `fed.json` configuration file.

## Installation

    $ sudo npm install --global node-fed

## Usage

    $ fed [directories...] <command>

- directories 
Name(s) of directory or group to loop through.
If loop through all directories (from config) by default

- command 
Arbitrary shell command
    
## fed.json

List all directories

    {
        "dirs" : [
            {
                "name"   : "Dir1",
                "groups" : ["group1"]
            },
            {
                "name"   : "Dir2",
                "groups" : ["group1", "group2"]
            },
            {
                "name"   : "Dir3",
                "groups" : ["group2"]
            }
        ]
    }
    
- name   {String} Directory name
- groups {String[]} Optional, Use to groups or alias a directory
    
## Commands

By default, fed execute the command as following:

    $ cd <dir.name>
    $ <command>
    $ cd -
    
**Examples**

List all files in all directories

    $ fed ls
    
    On dir1...
    
    README.md	file1
    
    On dir2...
    
    README.md	file2
    
    On dir3...
        
    README.md	file3
    
List all files of directory group


    $ fed group1 ls
    
    On dir1...
    
    README.md	file1
    
    On dir2...
    
    README.md	file2
        

## Special commands

### fed-list

List all directories register in the `fed.json` configuration file

**Usage** 

    $ fed [directories...] fed-list [-v|--verbose]
    
**Examples**
    
List all directories

    $ fed fed-list 
    dir1
    dir2
    dir3

List all directories in the specified group

    $ fed group1 fed-list
    dir1
    dir2

List all directories with verbose option

    $ fed group1 fed-list -v
    dir1
    {
        "name" : "dir1",
        "groups" : ["group1"]
    }
    
    dir2
    {
        "name" : "dir2",
        "groups" : ["group1", "group2"]
    }
    
### fed-modules

List all fed modules currently loaded
 
**Usage**

    $ fed fed-modules

**Examples**

    $ fed fed-modules
    fed-git

### fed-add-modules

Add fed module(s) globally or locally

**Usage**

    $ fed fed-add-modules <modules...> [-g|--global]
        
**Examples**

    $ fed fed-add-modules fed-git --global
    
### fed-rm-modules

Remove fed module(s) globally or locally

**Usage**

    $ fed fed-rm-modules <modules...> [-g|--global]

**Examples**

    $ fed fed-rm-modules fed-git --global

## Examples usage

Create a copyright file in all of your directory

    $ fed echo "Copyright (c) 2015" '>' copyright.txt
    $ fed ls
        
    On dir1...
    
    README.md	file1   copyright.txt
    
    On dir2...
    
    README.md	file2   copyright.txt
    
    On dir3...
        
    README.md	file3   copyright.txt

## Modules

A fed module is a node package which customize the command to execute.
Once one fed find a module that can treat the command, it execute use it.

A fed module looks like this:

    /**
     * Name of the fed module
     *
     * @type {String}
     */
    exports.name = "Name of the fed module";

    /**
     * When true, fed will not try to browse into the directory. 
     * The command will then be executed from the current working directory.
     * 
     * For example a command like `git clone` doesn't need to browse to the sub-directory,
     * because it suppose to not yet exist.
     * The fed-git module don't browse to the directory in case of `git clone` command.
     *
     * @type {Boolean=false}
     */
    exports.preventBrowse = false|true;
    
    /**
     * By default fed output the message `On <dir.name> ...\n', before each command. 
     * If preventDefaultEcho = true that default message will be skipped  
     *
     * @type {Boolean=false}
     */
    exports.preventDefaultEcho = false|true;
    
    /**
     * Indicates if fed have to stop his iteration after the command execution.
     * @type {Boolean=false}
     */
    exports.stopIteration = false|true;

    /**
     * Indicates if the current module is able to treat the 
     * specified command
     *
     * @param {String} command Command that fed will to execute 
     * @param {Object} dir Directory object
     *
     * @return {Boolean} True if the module can execute the command
     */
    exports.canDo = function (command, dir) {};
    
    /**
     * Returns the command to execute
     * 
     * If the return value is falsy, fed will do nothing for this command/directory
     *
     * @param {String} command Command that fed will execute
     * @param {Object} dir Directory object
     * @return {String|null} Command to execute 
     */
    exports.getCommand = function (command, dir) {};

## fed_modules.json

Fed modules can be declared globally at the root of '/fed' installation, 
or locally at the root of the working directory.

Simply add a file name `fed_modules.json` with the following format:

    [
        {
            "name" : "name of the module 1"
        },
        {
            "name" : "name of the module 2"
        }
    ]

The order of the module is important, the last module have higher priority than the first.
Local modules are higher priorities than global modules.


