const jsonServer = require('json-server');
const path = require('path');
const { requireAuthHeader, handleAuth } = require('./lib/auth');
const { v4: uuidv4 } = require('uuid');

const app = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, '..', 'db.json'));

// Set default middleware (logger, static, cors and no-cache)
app.use(jsonServer.defaults());
app.use(jsonServer.bodyParser);

app.use(
  jsonServer.rewriter({
    '/api/*': '/$1',
    '/auth/registration': '/register',
    '/auth/login': '/login',
    '/auth/profile': '/profile',
  })
);
// Add custom routes before JSON Server router
handleAuth(app, router);

app.use(requireAuthHeader);
// To handle POST, PUT and PATCH you need to use a body-parser
// You can use the one used by JSON Server
app.use((req, res, next) => {
  switch (req.method) {
    case 'POST':
      req.body.id = uuidv4();

      req.body.createdAt = new Date(Date.now()).toISOString();
      req.body.updateAt = new Date(Date.now()).toISOString();
      break;
    case 'PUT':
    case 'PATCH':
      req.body.updateAt = new Date(Date.now()).toISOString();
      break;
  }
  // Continue to JSON Server router
  next();
});

app.use('/projects', (req, res, next) => {
  req.body.owner = req.user.id;
  next();
});

// You must apply the auth middleware before the router
app.use(router);
app.listen(5000, () => {
  console.log('JSON Server is running');
});
