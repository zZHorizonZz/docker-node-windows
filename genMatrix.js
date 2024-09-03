'use strict';
const path = require('path');
const fs = require('fs');

const testFiles = [
  'genMatrix.js',
  '.github/workflows/build-test.yml',
];

const nodeDirRegex = /^\d+$/;
// Directories starting with 'windows-' are excluded from the matrix windows-2019 are excluded for example
const windowsDirRegex = /^windows-/;

const areTestFilesChanged = (changedFiles) => changedFiles
  .some((file) => testFiles.includes(file));

// Returns a list of the child directories in the given path, excluding those starting with 'windows-'
const getChildDirectories = (parent) => fs.readdirSync(parent, { withFileTypes: true })
  .filter((directory) => directory.isDirectory())
  .map(({ name }) => path.resolve(parent, name));

const getNodeVersionDirs = (base) => getChildDirectories(base)
  .filter((childPath) => nodeDirRegex.test(path.basename(childPath)));

// Returns the paths of Dockerfiles that are at: base/*/Dockerfile
const getDockerfilesInChildDirs = (base) => getChildDirectories(base)
  .filter((directory) => directory.isDirectory() && !windowsDirRegex.test(directory.name))
  // Test print the directories
  .map((childDir) => {
    console.log(childDir);
    return childDir;
  })
  .map((childDir) => path.resolve(childDir, 'Dockerfile'));

const getAllDockerfiles = (base) => getNodeVersionDirs(base).flatMap(getDockerfilesInChildDirs);

const getAffectedDockerfiles = (filesAdded, filesModified, filesRenamed) => {
  const files = [
    ...filesAdded,
    ...filesModified,
    ...filesRenamed,
  ];

  // If the test files were changed, include everything
  if (areTestFilesChanged(files)) {
    console.log('Test files changed so scheduling all Dockerfiles');
    return getAllDockerfiles(__dirname);
  }

  const modifiedDockerfiles = files.filter((file) => file.endsWith('/Dockerfile'));

  // Get Dockerfiles affected by modified docker-entrypoint.sh files
  const entrypointAffectedDockerfiles = files
    .filter((file) => file.endsWith('/docker-entrypoint.sh'))
    .map((file) => path.resolve(path.dirname(file), 'Dockerfile'));

  return [
    ...modifiedDockerfiles,
    ...entrypointAffectedDockerfiles,
  ];
};

const getFullNodeVersionFromDockerfile = (file) => fs.readFileSync(file, 'utf8')
  .match(/^ENV NODE_VERSION (\d*\.*\d*\.\d*)/m)[1];

const getDockerfileMatrixEntry = (file) => {
  const [variant] = path.dirname(file).split(path.sep).slice(-1);

  const version = getFullNodeVersionFromDockerfile(file);

  return {
    version,
    variant,
  };
};

const generateBuildMatrix = (filesAdded, filesModified, filesRenamed) => {
  const dockerfiles = [...new Set(getAffectedDockerfiles(filesAdded, filesModified, filesRenamed))];

  const entries = dockerfiles.map(getDockerfileMatrixEntry);

  // Return null if there are no entries so we can skip the matrix step
  return entries.length
    ? { include: entries }
    : null;
};

module.exports = generateBuildMatrix;
