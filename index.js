const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');

const app = express();
const port = 3000;

// MySQL Connection Configuration
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '#Livfast2',
  database: 'biblio_forum',
  port: '3306' // Your MySQL port
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware to disable caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Root route to redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Route to display the login form
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to handle login form submission
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ?';

  connection.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error querying MySQL:', err);
      return res.status(500).send('Internal server error');
    }

    if (results.length === 0 || results[0].password !== password) {
      return res.send('Invalid username or password');
    }

    req.session.username = username;
    res.redirect('/dashboard');
  });
});

// Route to display the account creation form
app.get('/create-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create-account.html'));
});

// Route to handle account creation form submission
app.post('/create-account', (req, res) => {
  const { username, password } = req.body;
  const query = 'INSERT INTO users (username, password) VALUES (?, ?)';

  connection.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error inserting into MySQL:', err);
      return res.status(500).send('Internal server error');
    }

    req.session.username = username;
    res.redirect('/dashboard');
  });
});

// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (req.session.username) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Route to display the dashboard (protected)
app.get('/dashboard', checkAuth, (req, res) => {
    const query = 'SELECT id, genre, question, answer FROM questions';
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching questions:', err);
        res.status(500).send('Error fetching questions');
        return;
      }
  
      const genres = ['Autobiography', 'Adventure', 'Biography', 'Comedy', 'Coming-of-Age', 'Fantasy', 'Historical', 'Horror', 'International', 'Memoir', 'Mystery', 'Poetry', 'Romance', 'Science-Fiction', 'Thriller', 'Travel', 'Young-Adult'];
  
      // Create a map to collect questions and their answers
      const questionMap = {};
      results.forEach(row => {
        if (!questionMap[row.id]) {
          questionMap[row.id] = {
            id: row.id,
            genre: row.genre,
            question: row.question,
            answers: []
          };
        }
        if (row.answer) {
          questionMap[row.id].answers.push(row.answer);
        }
      });
  
      // Convert the map to an array of questions
      const questions = Object.values(questionMap);
  
      res.render('dashboard', {
        username: req.session.username,
        genres: genres,
        questions: questions
      });
    });
  });
  
  

// Route to handle logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

// Route to handle form submission from the dashboard
// Route to handle form submission from the dashboard
app.post('/submit-answer', checkAuth, (req, res) => {
    const { questionId, answer } = req.body;
    
    const querySelect = `SELECT answer FROM questions WHERE id = ?`;
    const queryUpdate = `UPDATE questions SET answer = ? WHERE id = ?`;

    connection.query(querySelect, [questionId], (err, results) => {
        if (err) {
            console.error('Error fetching answers:', err);
            res.status(500).send({ message: 'Error fetching answers' });
            return;
        }

        const currentAnswers = results[0].answer ? JSON.parse(results[0].answer) : [];
        currentAnswers.push(answer); // Add the new answer to the existing array

        connection.query(queryUpdate, [JSON.stringify(currentAnswers), questionId], (err, result) => {
            if (err) {
                console.error('Error updating answers:', err);
                res.status(500).send({ message: 'Error updating answers' });
                return;
            }

            res.send({ message: 'Answer submitted successfully' });
        });
    });
});


// Route to display questions by genre
app.get('/genre/:genre', checkAuth, (req, res) => {
    const genre = req.params.genre;
    const query = `SELECT * FROM questions WHERE genre = ?`;
  
    connection.query(query, [genre], (err, results) => {
      if (err) {
        console.error('Error fetching questions by genre:', err);
        res.status(500).send('Error fetching questions by genre');
        return;
      }
      res.render('genre', {
        username: req.session.username,
        genre: genre,
        questions: results
      });
    });
  });

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
