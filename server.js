const express = require("express");
const axios = require("axios"); // You may need to install axios if not already installed
const { OpenAI } = require('openai');
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());

// Initialize Openai
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // defaults to process.env["OPENAI_API_KEY"]
});

if (!openai.apiKey) {
  console.log("Error");
  // return;
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
  try {
    const json = req.body;
  const nameOfFile = json.nameOfFile; // Replace with your logic to get the file name
  const userId = json.userId;
  console.log("This is the json: ", nameOfFile);

  const { data: pdfData } = await supabase
    .from("pdfs")
    .select("*")
    .eq("pdf_name", nameOfFile)
    .eq("user_id", userId);

    // const { data: pdfData, error } = await supabase.storage
    //   .from("pdfFiles")
    //   .download(`${userId}/${nameOfFile}`);

  console.log("extracted: ", JSON.stringify(pdfData));

  if (pdfData !== null || error) {
    console.log("length of file: ", pdfData.length);
  }

  if (!openai.apiKey) {
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

  const queryEmbedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });
  console.log("openai point:", query);

  const xq = queryEmbedding.data[0].embedding;

  console.log("embedding: " + xq);

  const deleteLastQuestion = async () => {
    try{
      const { data: rowData, error } = await supabase
      .from('chats')
      .select('chats')
      .eq('user_id', userId);
  
      if (rowData && rowData.length > 0) {
        const newArray = rowData[0].chats;
        const revertedArray = newArray.pop();
  
        if (revertedArray) {
          try {
            const { data: revertedData, error: revertError } = await supabase
            .from('chats')
            .update({ chats: revertedArray })
            .eq('user_id', userId);
        
          if (revertError) {
            // Handle the update error.
            console.log(revertError)
          } else {
            // Handle the successful update.
            console.log(revertedData)
          }          
          } catch (err) {
            console.log(err)
          }
        }
      }
    }catch(err){
      console.log(err)
    }    
  }

  const getChatHistory = async () => {
    try{
      const condition = { column_value: userId }; // Replace with your own condition

      function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
  
      const data = await delay(5000).then(async () => {
        try {
          const { data, error } = await supabase
          .from('chats')
          .select()
          .eq('user_id', condition.column_value);
    
        if (error) {
          console.log(error);
        } else {
          console.log("This is the get chat history: " + JSON.stringify(data[0].chats));
          return data[0].chats;
        }
        } catch (err) {
         console.log(err) 
         const history = await getChatHistory()
          if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
            deleteLastQuestion()
          }
        }
      });
    
      return data;
    }catch(err){
      console.log(err)
    }    
  }

  const createUser = async (finalPrompt) => {
    try{
      const { data, error } = await supabase
      .from('chats')
      .insert([{ user_id: userId,  chats: [{role: 'user', content: finalPrompt}]}])
      .select()
  
      console.log(data)
    }catch(err){
      console.log(err)
    }
  }

  const upsertAssistant = async (response) => {
    try{
      const { data: rowData, error } = await supabase
      .from('chats')
      .select('chats')
      .eq('user_id', userId);
  
      if (rowData && rowData.length > 0) {
        const currentArray = rowData[0].chats;
        const newValue = {role: 'assistant', content: response};
        
        const updatedArray = [...currentArray, newValue];           
        // You can also perform other modifications as needed.
  
        if (updatedArray) {
          try {
            const { data: updatedData, error: updateError } = await supabase
            .from('chats')
            .update({ chats: updatedArray })
            .eq('user_id', userId);
        
          if (updateError) {
            // Handle the update error.
            console.log(updateError)
          } else {
            // Handle the successful update.
            console.log(updatedData)
          }
          } catch (err) {
            console.log(err)
          }
        }
      }
    }catch(err) {
      console.log(err)
    }
  }

  const upsertUser = async (finalPrompt) => {
    try{
      const { data: rowData, error } = await supabase
      .from('chats')
      .select('chats')
      .eq('user_id', userId);
  
      if (rowData && rowData.length > 0) {
        const currentArray = rowData[0].chats;
        const newValue = {role: 'user', content: finalPrompt};
        
        const updatedArray = [...currentArray, newValue];           
        // You can also perform other modifications as needed.
        if (updatedArray) {
          try {
            const { data: updatedData, error: updateError } = await supabase
            .from('chats')
            .update({ chats: updatedArray })
            .eq('user_id', userId);
        
          if (updateError) {
            // Handle the update error.
            console.log(updateError)
          } else {
            // Handle the successful update.
            console.log(updatedData)
          }
          } catch (err) {
            console.log(err)
          }
        }
      }
    }catch(err){
      console.log(err)
    }    
  }

  const checkIfRowExists = async (finalPrompt) => {
    try{
      const condition = { column_value: userId }; // Replace with your own condition

      const { data, error } = await supabase
      .from('chats')
      .select()
      .eq('user_id', condition.column_value);
  
      if (data && data.length > 0) {
        const history = await getChatHistory()
          if(history[history.length-1].role === "assistant"){
            upsertUser(finalPrompt)
          }
          else{
            res.json(400).send("There was an error sending your query")
          }
      } else {
        createUser(finalPrompt)
      }
    }catch(err){
      console.log(err)
    }
    
  }

  const processAnswers = async () => {
    try {
      function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
  
        const result = delay(7000).then(async () => {
        try {
          const history = await getChatHistory()
          console.log("This is the history: " + history)
          console.log("This is the history: " + JSON.stringify(history))
    
          
            const chatCompletion = await openai.chat.completions.create({
              messages: history,
              model: 'gpt-3.5-turbo',
              max_tokens: 2048,
            });
          
            console.log("Chat completion: " + chatCompletion);
            console.log("Chat completion.choices: " + chatCompletion.choices);
            
            const chatResponse = chatCompletion.choices[0].message.content

            if(history[history.length-1].role === "user"){
              upsertAssistant(chatResponse)
            }
            else{
              res.json(400).send("There was an error sending your query")
            }
            
            const history2 = await getChatHistory()
    
            const result= {
              query: history2,
              completion: chatResponse
            }
    
            return result  
        } catch (err) {
          console.log(err)
          const history = await getChatHistory()
          if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
            deleteLastQuestion()
          }
        }
      })
      return result
    } catch (err) {
      console.log(err)
      const history = await getChatHistory()
      if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
        deleteLastQuestion()
      }
    }    
  }

  function calculateDotProductSimilarity(vector1, vector2) {
    try {
      if (vector1.length !== vector2.length) {
        throw new Error("Vector dimensions do not match");
      }
  
      let dotProduct = 0;
      for (let i = 0; i < vector1.length; i++) {
        dotProduct += vector1[i] * vector2[i];
      }
      return dotProduct;
    } catch (err) {
      console.log(err)
    }
  }

  async function calculateSimilarityScores(userQueryEmbedding, pdfData) {
    try {
      const similarityScores = [];
      pdfData.forEach((row) => {
        const pageEmbedding = row.vector_data;
        const similarity = calculateDotProductSimilarity(
          userQueryEmbedding,
          pageEmbedding
        );
  
        similarityScores.push({
          pageData: row,
          similarity: similarity,
        });
      });
  
      // Sort by similarity in descending order
      similarityScores.sort((a, b) => b.similarity - a.similarity);
  
      if (similarityScores.length > 0) {
        // Select the top 5 pages
        const top5SimilarPages = similarityScores.slice(0, 5);
        console.log(top5SimilarPages);
  
        // To get the results
  
        const mostSimilar = top5SimilarPages[0].pageData.page_text;
        const inputText = mostSimilar;
  
        const plainText = inputText.replace(/[+\n]/g, "");
  
        console.log(plainText);
  
        console.log("Query Info:", plainText);
        const finalPrompt = `
              Info: Using this info: ${plainText} make the answer as explanatory as possible. With points and examples
              Question: ${query}.
              Answer:
            `;
  
        try {
  
          checkIfRowExists(finalPrompt)
          const result = await processAnswers()
  
          // const response = await openai.createCompletion({
          //   model: COMPLETIONS_MODEL,
          //   prompt: finalPrompt,
          //   max_tokens: 2048,
          // });
  
          // const completion = response.data.choices[0].text;
          // console.log(completion);
          // console.log(query);
  
          // const result = {
          //   query: query,
          //   completion: completion,
          // };
  
          console.log("Funny how this will work: " + JSON.stringify(result));
  
          res.status(200).json(result);
        } catch (error) {
          const history = await getChatHistory()
          if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
            deleteLastQuestion()
          }
          if (error.response) {
            console.error(error.response.status, error.response.data);
            res.status(error.response.status).json(error.response.data);
          } else {
            console.error(`Error with request: ${error.message}`);
            res
              .status(500)
              .json({ error: "An error occurred during your request." });
          }
        }
      } else {
        // Handle the case where there are no similarity scores
        console.log("No similarity scores found.");
      //   const finalPrompt = `
      //   Info: Welcome the user to Lecture Mate in a polite manner and ask how you can be of service. You can use different approaches to welcome the user but always be friendly.
      //   Question: ${query}.
      //   Answer:
      // `;
  
        try {
          checkIfRowExists(query)
          const result = await processAnswers()
          // const response = await openai.createCompletion({
          //   model: COMPLETIONS_MODEL,
          //   prompt: finalPrompt,
          //   max_tokens: 2048,
          // });
  
          // const completion = response.data.choices[0].text;
          // console.log(completion);
          // console.log(query);
  
          // const result = {
          //   query: query,
          //   completion: completion,
          // };
  
          // console.log("Funny how this will work: " + JSON.stringify(result));
  
          res.status(200).json(result);
        } catch (error) {
          const history = await getChatHistory()
          if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
            deleteLastQuestion()
          }

          if (error.response) {
            console.error(error.response.status, error.response.data);
            res.status(error.response.status).json(error.response.data);
          } else {
            console.error(`Error with request: ${error.message}`);
            res
              .status(500)
              .json({ error: "An error occurred during your request." });
          }
        }
      }
    } catch (err) {
      console.log(err)
      const history = await getChatHistory()
      if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
        deleteLastQuestion()
      }
    }    
  }

  await calculateSimilarityScores(xq, pdfData);
  } catch (err) {
    console.log(err)
  }
});

const port = 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
