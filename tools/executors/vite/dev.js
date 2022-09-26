"use strict";
exports.__esModule = true;
var child_process_1 = require("child_process");
function devExecutor(_, context) {
    console.info("Executing \"vite\"...");
    var projectDir = context.workspace.projects[context.projectName].root;
    return new Promise(function (resolve, reject) {
        var devProcess = (0, child_process_1.exec)("vite --config ".concat(projectDir, "/vite.config.js --port 3000"), function (error, stdout, stderr) {
            if (error) {
                reject(error);
            }
            resolve({ success: !stderr });
        });
        devProcess.stdout.setEncoding("utf8");
        devProcess.stdout.on("data", console.log);
        devProcess.stderr.setEncoding("utf8");
        devProcess.stderr.on("data", console.error);
    });
}
exports["default"] = devExecutor;
