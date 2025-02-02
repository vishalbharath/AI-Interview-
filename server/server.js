const express = require("express");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const { createServer } = require("http");
const Chatbot = require("./chatEngine.js");
const process = require("process");
const cors = require('cors')
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require("mongoose");


dotenv.config();
const Groq = require('groq-sdk');

const app = express();

app.use(cors());
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const chatbot = new Chatbot("public" === "public");

app.use(express.static("dist"));

io.on("connection", (socket) => {
    console.log(`CONNECTED ${socket.id}`);

    socket.on("disconnect", (reason) => {
        console.log(`DISCONNECTED ${socket.id}: ${reason}`);
    });

    socket.on("init", (settings) => {
        try {
            chatbot.initialize(settings, socket.id);
            socket.emit("responseInit", true);
            console.log(`INITIALIZED ${socket.id}`);
        } catch (err) {
            console.log(err);
            socket.emit("responseInit", false);
            console.log(`INIT FAILED ${socket.id}`);
        }
    });

    socket.on("message", async (data) => {
        try {
            console.log("Received data:", data);
    
            if (!data || typeof data.question !== "string") {
                throw new TypeError("The 'question' property must be a string.");
            }
            // let response;
            // console.log("Processing question:", data.question);
            // let isAIReplaied = true;
            // while(isAIReplaied)
            // {
            //   try{
            //    response = await chatbot.chat(data.question,data.duration,data.interviewStartTime,data.name);
            //    isAIReplaied = false;
            //   }
            //   catch{
            //     console.log("Ai replaied error");
            //   }
            // }
            const response = await chatbot.chat(data.question,data.duration,data.interviewStartTime,data.name);
            const speechData = await chatbot.textToSpeech(response);
    
            console.log(`RESPONSE (${socket.id}): ${response}`);
            console.log(`AUDIO (${socket.id}): ${speechData.audioFilePath}`);
    
            socket.emit("responseMessage", {
                response: response,
                speechData: speechData,
            });
        } catch (err) {
            console.error(`ERROR (${socket.id}):`, err.message);
    
            socket.emit("responseMessage", {
                response: "Sorry, I don't understand that.",
                speechData: null,
            });
        }
    });
    
});

app.get('/api/evaluateInterview', async (req, res) => {  
  const { interviewDuration: interviewDuration, name } = req.query;  

  if (!interviewDuration || !name) {  
      return res.status(400).json({ error: "interviewStartTime and name are required" });  
  }  

  const interviewProgress = await chatbot.evaluateInterviewProgress(interviewDuration, name);  
            
  return res.json(interviewProgress);  
});




//SKILLS

const skillsScoreSchema = new mongoose.Schema({
  email: { type: String, default: 'xxx' },
  listening_score: { type: Number, default: 0 },
  reading_score: { type: Number, default: 0 },
  writing_score: { type: Number, default: 0 },
  speaking_score: { type: Number, default: 0 },
});

// Create a Mongoose model based on the schema
const SkillsScore = mongoose.model('SkillsScore', skillsScoreSchema);


//READING


const groq = new Groq({ apiKey: "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" });

const fetchParagraph = async () => {
  const { default: fetch } = await import('node-fetch');
  const response = await fetch('http://metaphorpsum.com/paragraphs/8');
  const data = await response.text();
  return data;
};
  const generateQuestions = async (paragraph) => {
    const prompt = `
    Generate exactly 5 multiple-choice questions from the following paragraph. Each question should have four options (A, B, C, D) and the correct answer. Format the response as a JSON object with the following structure:
    
    \`\`\`json
    {
        "questions": [
            {
                "question": "Question text?",
                "options": {
                    "A": "Option A",
                    "B": "Option B",
                    "C": "Option C",
                    "D": "Option D"
                },
                "answer": "B"
            }
           
        ]
    }
    \`\`\`
    
    Provide the response in the JSON format shown above without any additional text or explanation and Json List Must contain only 5 Object
    
    **Paragraph:**
    
    ${paragraph}
    `;    console.log('Prompt:', prompt);
  
    try {
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        model: "llama3-8b-8192",
      });
  
      console.log("Groq Response:", response);
  
      const content = response.choices[0]?.message?.content || '';
      console.log('Content:', content);
  
      if (!content) {
        throw new Error("The response content is empty.");
      }


    return content;

  
    } catch (error) {
      console.error('Error generating questions:', error);
      return {
        response_code: 1,
        results: []
      };
    }
  };
  
  app.post('/generate-content', async (req, res) => {
    try {
      const paragraph = await fetchParagraph();
      console.log('Paragraph:', paragraph);
  
      const result = await generateQuestions(paragraph);
      const questions = JSON.parse(result);

      res.json({ paragraph, questions });
    } catch (error) {
      console.error('Error generating content:', error);
      res.status(500).send("Error generating content");
    }
  });
  
  //writing


const questionsPath = path.join(__dirname, 'questions.json');
let questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

app.get('/api/question', (req, res) => {
  const randomIndex = Math.floor(Math.random() * questions.length);
  const question = questions[randomIndex];
  res.json(question);
});

app.use(express.json());


app.post('/api/submit', async (req, res) => {
  console.log("JJJJJJJJ", req.body); 
  const { letter } = req.body;      

  if (!letter) {
    return res.status(400).json({ error: 'Letter content is required' });
  }

  try {
    const feedback = await generateFeedback(letter);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Error fetching feedback' });
  }
});
async function generateFeedback(letter) {
  try {
    const prompt = `Please analyze the following letter for grammar mistakes, spelling mistakes, and provide feedback. Give an overall mark out of 25 and suggestions for improvement.
    {
      "grammarMistakes": 10,
      "spellingMistakes": 5,
      "totalMarks": 10,
      "feedback": "sentence"
    }      
        Provide the response in the JSON format shown above without any additional text or explanation and Json List Must contain only 1 Object
\n\n${letter}`;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: prompt,
        },
      ],
      model: 'llama3-8b-8192',
    });

    const { content } = response.choices[0].message;
    console.log('Raw content received:', content); 
    const answer = JSON.parse(content);
    return answer;
  } catch (error) {
    console.error('Error generating feedback:', error);
    throw new Error('Failed to generate feedback');
  }
}

//Listening
app.use(bodyParser.json());

app.post('/listen-generate-content', async (req, res) => {
  const { paragraph } = req.body;
  console.log("ppp",paragraph);
  if (!paragraph) {
    return res.status(400).send("No paragraph provided");
  }
  try {
    const result = await generateQuestions(paragraph);
    const questions = JSON.parse(result);
    res.json({ paragraph, questions });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).send("Error generating content");
  }
});


//Speaking

app.post('/analyze', async (req, res) => {
  const { text } = req.body;

  if (!text) {
      return res.status(400).send('Text is required for analysis');
  }

  const prompt = `
  Please analyze the following speech text and return only the JSON object, with integer values for the scores and string feedbacks for each category.

  The analysis should be based on these categories, and all values must be out of 10:
  
  - Vocabulary Complexity
  - Vocabulary Repetition
  - Pronunciation
  - Task Response
  - Fluency
  - Lexical Resource
  - Grammatical Range & Accuracy

  Provide an overall score out of 100 with feedback for the overall performance.

  The JSON object must have the following structure:
  {
    "vocabularyComplexity": {
      "score": 0-10,
      "feedback": "string"
    },
    "vocabularyRepetition": {
      "score": 0-10,
      "feedback": "string"
    },
    "pronunciation": {
      "score": 0-10,
      "feedback": "string"
    },
    "taskResponse": {
      "score": 0-10,
      "feedback": "string"
    },
    "fluency": {
      "score": 0-10,
      "feedback": "string"
    },
    "lexicalResource": {
      "score": 0-10,
      "feedback": "string"
    },
    "grammaticalRangeAccuracy": {
      "score": 0-10,
      "feedback": "string"
    },
    "overallScore": {
      "score": 0-100,
      "feedback": "string"
    }
  }

  Only return the JSON object, without any extra text.
  
  Speech Text: "${text}"
  `;

  try {
      const response = await groq.chat.completions.create({
          messages: [
              {
                  role: "system",
                  content: prompt
              },
              {
                  role: "user",
                  content: text
              }
          ],
          model: "llama3-8b-8192"
      });

      let content = response.choices[0]?.message?.content;
      console.log('Raw response content:', content);

      content = content.trim();

      try {
          const analysisResult = JSON.parse(content);
          res.json(analysisResult);
      } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          console.log('Raw response content:', content); 
          res.status(500).send('Error analyzing the text: Invalid JSON format');
      }
  } catch (error) {
      console.error('Error sending text to Groq AI:', error.message);
      res.status(500).send('Error analyzing the text');
  }
});


//score skills
app.post('/update-skill-score', async (req, res) => {
  try {
    // Retrieve scores from request body
    const { name ,listening_score, reading_score, writing_score, speaking_score } = req.body;

    // Create a new skills score document
    const newSkillsScore = new SkillsScore({
      email:name,
      listening_score: listening_score || 0,
      reading_score: reading_score || 0,
      writing_score: writing_score || 0,
      speaking_score: speaking_score || 0,
    });

    // Save the new skills score document
    await newSkillsScore.save(); // Make sure this is inside the async function

    // Respond with a success message
    res.status(201).json({ message: 'Skills score saved successfully', newSkillsScore });
  } catch (error) {
    console.error('Error saving skills score:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use(express.json());
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});

