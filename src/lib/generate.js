const faker = require('faker');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { promisify } = require('util');
const crypto = require('crypto');
const _ = require('lodash');
const { hashPassword } = require('./auth');
const { green, cyan } = require('chalk');
require('dotenv').config();

const NUM_OF_USERS = 1;
const NUM_OF_PROJECTS_PER_USER = 2;
const NUM_OF_SECTIONS_PER_PROJECT = 7;
const NUM_OF_TASKS_PER_SECTION = 20;
const NUM_OF_COMMENTS_PER_TASK = 2;

// change from callback function to promise based
const writeFile = promisify(fs.writeFile);
const removeFile = promisify(rimraf);

// File PAth
const DB_PATH = path.join(__dirname, 'db.json');

const generateFile = async (obj) => {
  try {
    // remove the file if exists
    if (fs.existsSync(DB_PATH)) await removeFile(DB_PATH);
    // create the file with the mock data
    await writeFile(DB_PATH, JSON.stringify(obj, null, 2), {
      encoding: 'utf-8',
    });
    console.log(green('db.json created.'));
  } catch (error) {}
};

const generateArray = (num, data) => new Array(num).fill(data ? data : null);

const generateComment = (taskId, authorId) => ({
  id: faker.datatype.uuid(),
  message: faker.lorem.paragraph(),
  taskId,
  authorId,
  createdAt: faker.datatype.datetime().toISOString(),
  updatedAt: faker.datatype.datetime().toISOString(),
});

const generateTask = (sectionId, orderIndex) => ({
  id: faker.datatype.uuid(),
  title: faker.commerce.product(),
  order: orderIndex,
  dueDate: null,
  description: null,
  sectionId,
  createdAt: faker.datatype.datetime().toISOString(),
  updatedAt: faker.datatype.datetime().toISOString(),
});

const generateSection = (projectId, orderIndex) => ({
  id: faker.datatype.uuid(),
  title: faker.commerce.department(),
  order: orderIndex,
  projectId,
  createdAt: faker.datatype.datetime().toISOString(),
  updatedAt: faker.datatype.datetime().toISOString(),
});

const generateProject = ({ id: owner }) => ({
  id: faker.datatype.uuid(),
  title: faker.company.companyName(),
  accessibility: _.sample([true, false]),
  owner,
  createdAt: faker.datatype.datetime().toISOString(),
  updatedAt: faker.datatype.datetime().toISOString(),
});

const generateUser = async (_value, index) => {
  const password = process.env.MOCK_PASSWORD || faker.internet.password();
  const hashedPassword = await hashPassword(password);
  const name = faker.internet.userName();
  const email =
    (index === 0 && process.env.MOCK_EMAIL) || faker.internet.email(name).toLowerCase().trim();

  setTimeout(function () {
    console.log('user generated:');
    console.log('email:', cyan(email.toLowerCase()));
    console.log('password', cyan(password));
  }, 3000);

  return {
    id: faker.datatype.uuid(),
    email,
    password: hashedPassword,
    name,
    role: _.sample(['user', 'guide', 'lead-guide', 'admin']),
    resetToken: crypto.createHash('sha256').digest('hex'),
    resetTokenExpires: faker.date.past().toISOString(),
  };
};

const generateDataProcess = async (
  database = {
    users: [],
    projects: [],
    sections: [],
    tasks: [],
    comments: [],
  }
) => {
  const insertUsers = () => Promise.all(generateArray(NUM_OF_USERS).map(generateUser));

  const insertProjectsForUser = (user) => {
    database.projects = [
      ...database.projects,
      ...generateArray(NUM_OF_PROJECTS_PER_USER).map(() => generateProject(user)),
    ];
  };

  const insertSectionsForProject = (project) => {
    database.sections = [
      ...database.sections,
      ...generateArray(NUM_OF_SECTIONS_PER_PROJECT).map((_value, index) =>
        generateSection(project.id, index)
      ),
    ];
  };

  const insertTasksForSection = (section) => {
    database.tasks = [
      ...database.tasks,
      ...generateArray(NUM_OF_TASKS_PER_SECTION).map((_value, index) =>
        generateTask(section.id, index)
      ),
    ];
  };

  const insertCommentsIntoTask = (task) => {
    database.comments = [
      ...database.comments,
      ...generateArray(NUM_OF_COMMENTS_PER_TASK).map(() =>
        generateComment(task.id, _.sample(database.users).id)
      ),
    ];
  };

  database.users = await insertUsers();
  database.users.forEach(insertProjectsForUser);
  database.projects.forEach(insertSectionsForProject);
  database.sections.forEach(insertTasksForSection);
  database.tasks.forEach(insertCommentsIntoTask);
  await generateFile(database);
};

generateDataProcess();
