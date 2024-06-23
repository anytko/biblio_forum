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
    saveUninitialized: true
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
  
      // Store userId and username in session
      const userId = results[0].id; // Assuming 'id' is your primary key column name
      req.session.userId = userId;
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
  
      // Fetch userId after successful insertion
      const userId = results.insertId; // Assuming 'id' is your auto-increment primary key column name
  
      // Store userId and username in session
      req.session.userId = userId;
      req.session.username = username;
  
      res.redirect('/dashboard');
    });
  });


// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
    if (req.session.username) {
      next(); // User is authenticated, continue to the next middleware or route handler
    } else {
      res.redirect('/login'); // User is not authenticated, redirect to the login page
    }
  };

// Route to display the dashboard (protected)
app.get('/dashboard/:genre?', checkAuth, (req, res) => {
    const selectedGenre = req.params.genre || null;
    let query = `
      SELECT q.id, q.genre, q.question, q.user_id AS question_user_id, qu.username AS question_username,
             a.id AS answer_id, a.answer, a.user_id AS answer_user_id, au.username AS answer_username
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN users qu ON q.user_id = qu.id
      LEFT JOIN users au ON a.user_id = au.id
    `;
  
    const params = [];
    if (selectedGenre) {
      query += ' WHERE q.genre = ?';
      params.push(selectedGenre);
    }
  
    connection.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching questions and answers:', err);
        res.status(500).send('Error fetching questions and answers');
        return;
      }
  
      const genres = ['Autobiography', 'Adventure', 'Biography', 'Comedy', 'Coming-of-Age', 'Fantasy', 'Historical', 'Horror', 'International', 'Memoir', 'Mystery', 'Poetry', 'Romance', 'Science-Fiction', 'Thriller', 'Travel', 'Young-Adult'];
  
      const questionMap = {};
      results.forEach(row => {
        if (!questionMap[row.id]) {
          questionMap[row.id] = {
            id: row.id,
            genre: row.genre,
            question: row.question,
            user_id: row.question_user_id,
            username: row.question_username,
            answers: []
          };
        }
        if (row.answer) {
          questionMap[row.id].answers.push({
            id: row.answer_id,
            text: row.answer,
            user_id: row.answer_user_id,
            username: row.answer_username
          });
        }
      });
  
      const questions = Object.values(questionMap);
  
      res.render('dashboard', {
        username: req.session.username,
        userId: req.session.userId,
        genres: genres,
        questions: questions,
        selectedGenre: selectedGenre
      });
    });
  });
  
  
  

// Route to fetch answers for a specific question
// Example route to fetch answers for a specific question
app.get('/fetch-answers/:questionId', checkAuth, (req, res) => {
    const questionId = req.params.questionId;

    const query = 'SELECT answer FROM answers WHERE question_id = ?';

    connection.query(query, [questionId], (err, results) => {
        if (err) {
            console.error('Error fetching answers:', err);
            return res.status(500).send({ message: 'Error fetching answers' });
        }

        // Map the results to extract only the answer values into an array
        const answers = results.map(result => result.answer);

        // Send the answers array as JSON response
        res.json({ answers: answers });
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

  
  // Route to handle form submission for answering a question
// Route to handle form submission for answering a question
app.post('/submit-answer', (req, res) => {
    const { questionId, answer, userId } = req.body; // Extract userId from the request body
  
    const query = 'INSERT INTO answers (question_id, answer, user_id) VALUES (?, ?, ?)';
    const params = [questionId, answer, userId];
  
    connection.query(query, params, (err, results) => {
      if (err) {
        console.error('Error submitting answer:', err);
        res.status(500).send('Error submitting answer');
        return;
      }
  
      // Fetch the username to include it in the response
      const fetchUserQuery = 'SELECT username FROM users WHERE id = ?';
      connection.query(fetchUserQuery, [userId], (err, userResults) => {
        if (err) {
          console.error('Error fetching username:', err);
          res.status(500).send('Error fetching username');
          return;
        }
        const username = userResults[0].username;
        res.send({ message: 'Answer submitted successfully', answer: { answer: answer, username: username } });
      });
    });
  });


  
  // Route to display questions by genre
// Route to fetch questions and answers by genre
app.get('/dashboard/genres/:genre', checkAuth, (req, res) => {
    const genre = req.params.genre;
    const query = `
      SELECT q.id as question_id, q.question, q.genre, qu.username as question_username, 
             a.answer, au.username as answer_username
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN users qu ON q.user_id = qu.id
      LEFT JOIN users au ON a.user_id = au.id
      WHERE q.genre = ?
    `;
  
    connection.query(query, [genre], (err, results) => {
      if (err) {
        console.error('Error fetching questions by genre:', err);
        res.status(500).json({ message: 'Error fetching questions by genre' });
        return;
      }
  
      const questions = results.reduce((acc, curr) => {
        const questionIndex = acc.findIndex(q => q.id === curr.question_id);
        if (questionIndex !== -1) {
          acc[questionIndex].answers.push({
            text: curr.answer,
            username: curr.answer_username
          });
        } else {
          acc.push({
            id: curr.question_id,
            genre: curr.genre,
            question: curr.question,
            username: curr.question_username,
            answers: curr.answer ? [{
              text: curr.answer,
              username: curr.answer_username
            }] : []
          });
        }
        return acc;
      }, []);
  
      console.log('Processed Questions:', questions);
      res.json(questions);
    });
  });
  

// Route to delete a question and its answers
// Route to delete a question and its answers
app.delete('/delete-question/:questionId', checkAuth, (req, res) => {
    const questionId = req.params.questionId;
  
    // Delete answers associated with the question first
    const deleteAnswersQuery = 'DELETE FROM answers WHERE question_id = ?';
    connection.query(deleteAnswersQuery, [questionId], (err, result) => {
      if (err) {
        console.error('Error deleting answers:', err);
        return res.status(500).send('Error deleting answers');
      }
  
      // After deleting answers, delete the question
      const deleteQuestionQuery = 'DELETE FROM questions WHERE id = ?';
      connection.query(deleteQuestionQuery, [questionId], (err, result) => {
        if (err) {
          console.error('Error deleting question:', err);
          return res.status(500).send('Error deleting question');
        }
  
        // Send an empty response
        res.end();
      });
    });
  });
  
  
  app.post('/add-question', (req, res) => {
    const { question, genre, userId } = req.body;
  
    // Ensure userId is present
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
  
    const query = 'INSERT INTO questions (question, genre, user_id) VALUES (?, ?, ?)';
    connection.query(query, [question, genre, userId], (err, result) => {
      if (err) {
        console.error('Error inserting into MySQL:', err);
        return res.status(500).send('Internal server error');
      }
  
      const insertedId = result.insertId; // Get the ID of the newly inserted question
      res.status(200).json({
        message: 'Question successfully added!',
        question: {
          id: insertedId,
          question: question,
          genre: genre,
          userId: userId // Include userId in the response
        }
      });
    });
  });
  

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});