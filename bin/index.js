// Packages
const program  = require("commander-plus");
const fs       = require("fs");
const path     = require("path");
const exec     = require("child_process").exec;
const readline = require("readline");

// edits prototypes, no variable needed
require("colors");

// String patterns
const git_clone_command = "cd {0} && git clone git@github.com:{1}.git";
const run_arbitrary_command = "cd {0} && {1}";


const main = function() {
	Promise.resolve() // Init promise chain
	.then(setup)
	.then(process_options)
	.then(run)
	.catch(function(err) {
		process.stdin.destroy();
		console.error(err);
	});
};

const setup = function() {
	program
		.version("1.0.1")
		.usage("<repos_folder> [options]")
		.option("-f, --file <path>","path to file containing repo urls")
		.option("-v, --verbose ","be more verbose")
		.option("-i, --interactive ","console style")
		.option("-s, --synchronous ","Run commands one repo at a time")
		.parse(process.argv);
};

const process_options = function() {
	const paramaters = {
		repos_folder: null,
		command: null,
		options: {
			verbose: false,
			interactive: false,
			synchronous: false,
			file: false,
			path: null
		}
	};

	if (program.args.length > 0) {
		paramaters.repos_folder = program.args[0];
	}

	if (program.args.length > 1) {
		paramaters.command = program.args[1];
	}

	if (program.file !== undefined) {
		paramaters.options.file = true;
		paramaters.options.path = program.file;
	} else if (program.args.length > 2) {
		paramaters.options.path = program.args[2];
	}

	if (program.verbose !== undefined) {
		paramaters.options.verbose = true;
	}

	if (program.interactive !== undefined) {
		paramaters.options.interactive = true;
	}

	if (program.synchronous !== undefined) {
		paramaters.options.synchronous = true;
	}

	return paramaters;
};

const run = function(paramaters) {
	var folder_exists = fs.existsSync(paramaters.repos_folder);
	if (!folder_exists) {
		return log_error("Folder does not exist");
	}

	if (paramaters.command === "add") {
		return add(paramaters);
	}
	if (paramaters.command === "run") {
		return run_command(paramaters);
	}
};

const add = function(paramaters) {
	var folder_path = paramaters.repos_folder;
	if (paramaters.options.file) {
		// read in file
		var file_path = paramaters.options.path;
		var file_exists = fs.existsSync(file_path);
		if (!file_exists) {
			return log_error("file does not exist: " + file_path);
		}
		var file_contents = fs.readFileSync(file_path, {encoding: "UTF-8"});
		var repos = file_contents.split("\n");

		if (paramaters.options.verbose) {
			console.log(`Cloning ${repos.length} Repos from "${file_path}" into "${folder_path}"`);
		}

		for (var i = 0; i < repos.length; i++) {
			if (repos[i] !== "") {
				add_repo(folder_path, repos[i], paramaters.options.verbose);
			}
		}
	} else {
		var repo_url = paramaters.options.path;
		add_repo(folder_path, repo_url, paramaters.options.verbose);
	}

};

const add_repo = function(folder, repo, verbose) {

	var repo_name = folder + "/" + repo.split("/")[1];

	var repo_already_exists = fs.existsSync(repo_name);

	if (!repo_already_exists) {
		if (verbose) {
			console.log(`Cloning "${repo_name}"`);
		}
		var cmd = format_string(git_clone_command, [folder, repo]);
		exec(cmd, (error, stderr, stdout) => {
			// command output is in stdout
			console.log(stdout.trim());
			if (error !== null) {
				log_error("CLone Failed");
			}
		});
	} else {
		if (verbose) {
			console.log(`Repo: "${repo_name} already exists"`);
		}
	}
};

const run_command = function(paramaters) {

	if (program.args.length > 2) {
		var command = program.args[2] = program.args[2];
	}

	if (paramaters.options.interactive) {
		console.log("Type commands to all repos (" + "q".red + " to quit, " + "-v".green + " for verbose)");
		var rl = readline.createInterface(process.stdin, process.stdout);
		rl.setPrompt("$ ".blue);
		rl.prompt();
		rl.on("line", function(command) {
			if (command === "q") rl.close();
			if (command.split("-v").length > 1) var verbose = true;
			run_command_on_all_repos(paramaters, command, verbose)
			.then(function() {
				rl.prompt();
			});
		}).on("close",function(){
			process.exit(0);
		});
	} else {
		run_command_on_all_repos(paramaters, command);
	}
};

const run_command_on_all_repos = function(paramaters, command, verbose) {
	if (command !== undefined) {

		verbose = verbose || paramaters.options.verbose;

		var folder_path = paramaters.repos_folder;

		var repos = fs.readdirSync(folder_path).filter(function(file) {
			return fs.statSync(path.join(folder_path, file)).isDirectory();
		});

		if (paramaters.options.synchronous) {
			console.log("Running command synchronously");
			var chain = Promise.resolve();
			for (var i = 0; i < repos.length; i++) {
				((index) => {
					chain.then(() => {
						var cmd = format_string(run_arbitrary_command, [folder_path + "/" + repos[index], command]);
						if (verbose) {
							console.log(cmd);
						}
						return run_command_on_repo(repos[index], cmd, verbose);
					});
				})(i);
			}
			chain.then(() => {
				if (verbose) {
					console.log("Done running commands");
				}
			});

			return chain;

		} else {
			console.log("Running command asynchronously");
			var promises = [];
			for (var i = 0; i < repos.length; i++) {
				var cmd = format_string(run_arbitrary_command, [folder_path + "/" + repos[i], command]);
				promises.push(run_command_on_repo(repos[i], cmd, verbose));
			}

			return Promise.all(promises);
		}
	}
};

const run_command_on_repo = function(repo, cmd, verbose) {
	return new Promise((resolve/*, reject*/) => {
		exec(cmd, (error, stdout/*, stderr*/) => {
			// command output is in stdout
			if (error !== null) {
				console.log(repo + " error".red);
				console.log(stdout);
			} else {
				console.log(repo + " success".green);
				if (verbose) {
					console.log(stdout);
				}
			}
			resolve();
		});
	});
};


const log_error = function(message) {
	console.error(message.red);
};

const format_string = function(input, values) {
	for (var i = 0; i < values.length; i++) {
		input = input.split("{" + i + "}").join(values[i]);
	}
	return input;
};


main();
