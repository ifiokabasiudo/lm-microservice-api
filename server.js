const express = require("express");
const axios = require("axios"); // You may need to install axios if not already installed
const { Configuration, OpenAIApi } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require("dotenv").config()

const app = express();

app.use(cors());

// Initialize Openai
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

if (!configuration.apiKey) {
  console.log("Error: OpenAI API key not properly configured");
  process.exit(1); // Terminate the Node.js process
} else {
  console.log("It's working");
}

// Declare constants
const COMPLETIONS_MODEL = "text-davinci-003";
const EMBEDDING_MODEL = "text-embedding-ada-002";
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supaUrl, supaKey);

app.use(express.json()); // Parse JSON requests

app.post("/api/api", async (req, res) => {
  const json = req.body;
  const nameOfFile = json.nameOfFile; // Replace with your logic to get the file name

  const userId = json.userId;
  console.log("This is the json: ", nameOfFile);

  const { data: pdfData } = await supabase
    .from("pdfs")
    .select("*")
    .eq("pdf_name", nameOfFile)
    .eq("user_id", userId);

  console.log("extracted: ", JSON.stringify(pdfData));

  if (pdfData !== null) {
    console.log("length of file: ", pdfData.length);
  }

  if (!configuration.apiKey) {
    console.error("OpenAI API key not properly configured");
    res.status(500).json({ error: "OpenAI API key not properly configured" });
    return;
  }

  const query = json.query || "";

  if (query.trim().length === 0) {
    console.error("Please enter a question");
    res.status(500).json({ error: "Please enter a question" });
    return;
  }

  const queryEmbedding = await openai.createEmbedding({
    model: EMBEDDING_MODEL,
    input: query,
  });
  console.log("openai point:", query);

  const xq = queryEmbedding.data.data[0].embedding;

  console.log("embedding: " + xq);

  function calculateDotProductSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error("Vector dimensions do not match");
    }

    let dotProduct = 0;
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
    }
    return dotProduct;
  }

  async function calculateSimilarityScores(userQueryEmbedding, pdfData) {
    const similarityScores = [];

    pdfData.forEach((row) => {
      const pageEmbedding = row.vector_data;
      const similarity = calculateDotProductSimilarity(userQueryEmbedding, pageEmbedding);

      similarityScores.push({
        pageData: row,
        similarity: similarity,
      });
    });

    // Sort by similarity in descending order
    similarityScores.sort((a, b) => b.similarity - a.similarity);

    if(similarityScores.length > 0){
        // Select the top 5 pages
        const top5SimilarPages = similarityScores.slice(0, 5);
        console.log(top5SimilarPages);
    
        // To get the results
    
        const mostSimilar = top5SimilarPages[0].pageData.page_text;
        const inputText = mostSimilar;
    
        const plainText = inputText.replace(/[+\n]/g, '');
    
        console.log(plainText);
    
        console.log("Query Info:", plainText);
        const finalPrompt = `
            Info: Using this info: ${plainText} make the answer as explanatory as possible. With points and examples
            Question: ${query}.
            Answer:
          `;
    
        try {
          const response = await openai.createCompletion({
            model: COMPLETIONS_MODEL,
            prompt: finalPrompt,
            max_tokens: 2048,
          });
    
          const completion = response.data.choices[0].text;
          console.log(completion);
          console.log(query);
    
          const result = {
            query: query,
            completion: completion,
          };
    
          console.log("Funny how this will work: " + JSON.stringify(result));
    
          res.status(200).json(result);
        } catch (error) {
          if (error.response) {
            console.error(error.response.status, error.response.data);
            res.status(error.response.status).json(error.response.data);
          } else {
            console.error(`Error with request: ${error.message}`);
            res.status(500).json({ error: "An error occurred during your request." });
          }
        }
    }else {
      console.log("No similarity scores found.");
      console.error("No similarity scores found.");
      res.status(500).json({ error: "No Similarity scores were found" });
      // Handle the case where there are no similarity scores
    }
  }

  await calculateSimilarityScores(xq, pdfData);
});

const port = 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
