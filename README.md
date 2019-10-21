# github-batch-processor
Run commands on a list of GitHub Repositories, useful for grading in a GitHub Classroom

## Setup
`npm install`.

## Commands

Clone all repos into a folder named repos: `node ./bin/index.js ./repos add --file=repos.txt`

Run a command in all repos: `node ./bin/index.js ./repos run "git checkout challenge4"`
