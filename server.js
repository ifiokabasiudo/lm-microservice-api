const express = require("express");
const axios = require("axios"); // You may need to install axios if not already installed
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

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

console.log("ITS STILL OUTSIDE POST");

app.post("/api/api", async (req, res) => {
  console.log("IT GOT WITHIN POST");

  try {
    const json = req.body;
    const nameOfFile = json.nameOfFile; // Replace with your logic to get the file name
    const userId = json.userId;
    const country = json.country;
    const role = json.role;
    const institute = json.institute;
    const retryQuery = json.retryQuery;
    const query = json.query || "";
    console.log("This is the json: ", nameOfFile);

    const { data: pdfData } = await supabase
      .from("pdfs")
      .select("*")
      .eq("pdf_name", nameOfFile)
      .eq("user_id", userId);

    // const { data: pdfData, error } = await supabase.storage
    //   .from("pdfFiles")
    //   .download(`${userId}/${nameOfFile}`);

    if (pdfData !== null || error) {
      console.log("length of file: ", pdfData.length);
    }

    if (!openai.apiKey) {
      console.error("OpenAI API key not properly configured");
      res.status(500).json({ error: "OpenAI API key not properly configured" });
      return;
    }

    let xq;

    if (retryQuery !== undefined) {
      try {
        const queryEmbedding = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: retryQuery[retryQuery.length - 1].content,
        });

        xq = queryEmbedding.data[0].embedding;

        console.log("embedding success");
      } catch (error) {
        console.log(error);
      }
    } else {
      if (query.trim().length === 0) {
        console.error("Please enter a question");
        res.status(500).json({ error: "Please enter a question" });
        return;
      }

      try {
        const queryEmbedding = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: query,
        });

        xq = queryEmbedding.data[0].embedding;

        console.log("embedding success");
      } catch (err) {
        console.log(err);
      }
    }

    const deleteLastQuestion = async () => {
      try {
        const { data: rowData, error } = await supabase
          .from("chats")
          .select("chats")
          .eq("user_id", userId);

        if (rowData && rowData.length > 0) {
          const newArray = rowData[0].chats;
          const revertedArray = newArray.pop();

          if (revertedArray) {
            try {
              const { data: revertedData, error: revertError } = await supabase
                .from("chats")
                .update({ chats: revertedArray })
                .eq("user_id", userId);

              if (revertError) {
                // Handle the update error.
                console.log(revertError);
              } else {
                // Handle the successful update.
                console.log(revertedData);
              }
            } catch (err) {
              console.log(err);
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
    };

    const getChatHistory = async () => {
      const condition = { column_value: userId }; // Replace with your own condition

      // function delay(ms) {
      //   return new Promise(resolve => setTimeout(resolve, ms));
      // }

      // const data = await delay(5000).then(async () => {
      try {
        const { data, error } = await supabase
          .from("chats")
          .select()
          .eq("user_id", condition.column_value)
          .eq("pdf_name", nameOfFile);

        if (error) {
          console.log(error);
        } else {
          console.log("Get chat history success");
          return data[0].chats;
        }
      } catch (err) {
        console.log(err);
      }
      // });

      // return data;
    };

    let date = new Date().toJSON();
    console.log(date); // 2022-06-17T11:06:50.369Z

    const createUser = async (finalPrompt) => {
      try {
        const { data, error } = await supabase
          .from("chats")
          .insert([
            {
              user_id: userId,
              chats: [{ role: "user", content: finalPrompt, time: new Date().toJSON() }],
              pdf_name: nameOfFile,
              country: country,
              role: role,
              institute: institute,
            },
          ])
          .select();

        console.log("Create user success");
      } catch (err) {
        console.log(err);
      }
    };

    const upsertAssistant = async (response, pages) => {
      try {
        const { data: rowData, error } = await supabase
          .from("chats")
          .select("chats")
          .eq("user_id", userId)
          .eq("pdf_name", nameOfFile);

        if (rowData && rowData.length > 0) {
          const currentArray = rowData[0].chats;

          let updatedArray;

          console.log(
            "This is the previous array role before upserting assistant. It should be user: " +
              currentArray[currentArray.length - 1].role
          );

          if (
            currentArray.length > 0 &&
            currentArray[currentArray.length - 1].role === "assistant"
          ) {
            // Update the existing assistant's response
            updatedArray = currentArray;
          } else {
            // Add a new entry for the assistant's response
            const newValue = { role: "assistant", content: response, pages: pages };
            updatedArray = [...currentArray, newValue];
          }

          // You can also perform other modifications as needed.

          if (updatedArray) {
            try {
              const { data: updatedData, error: updateError } = await supabase
                .from("chats")
                .update({ chats: updatedArray })
                .eq("user_id", userId)
                .eq("pdf_name", nameOfFile);

              if (updateError) {
                // Handle the update error.
                console.log(updateError);
              } else {
                // Handle the successful update.
                console.log("Update assistant success");
              }
            } catch (err) {
              console.log(err);
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
    };

    const upsertUser = async (finalPrompt) => {
      try {
        const { data: rowData, error } = await supabase
          .from("chats")
          .select("chats")
          .eq("user_id", userId)
          .eq("pdf_name", nameOfFile);

        if (rowData && rowData.length > 0) {
          const currentArray = rowData[0].chats;

          let updatedArray;

          console.log(
            "This is the previous array role before upserting user. It should be assistant: " +
              currentArray[currentArray.length - 1].role
          );

          if (
            currentArray.length > 0 &&
            currentArray[currentArray.length - 1].role === "user"
          ) {
            // Update the existing assistant's response
            updatedArray = currentArray;
          } else {
            // Add a new entry for the assistant's response
            const newValue = { role: "user", content: finalPrompt, time: new Date().toJSON() };
            updatedArray = [...currentArray, newValue];
          }

          // You can also perform other modifications as needed.
          if (updatedArray) {
            try {
              const { data: updatedData, error: updateError } = await supabase
                .from("chats")
                .update({ chats: updatedArray })
                .eq("user_id", userId)
                .eq("pdf_name", nameOfFile);

              if (updateError) {
                // Handle the update error.
                console.log(updateError);
              } else {
                // Handle the successful update.
                console.log("Update user success");
              }
            } catch (err) {
              console.log(err);
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
    };

    const checkIfRowExists = async (finalPrompt) => {
      console.log("Check if row exists")
      try {
        const condition = { column_value: userId }; // Replace with your own condition

        const { data, error } = await supabase
          .from("chats")
          .select()
          .eq("user_id", condition.column_value)
          .eq("pdf_name", nameOfFile);

        if (data && data.length > 0) {
          const history = await getChatHistory();

          console.log(
            "This is the history for check if row exists. It should be assistant: " +
              history[history.length - 1].role
          );

          if (history[history.length - 1].role === "assistant") {
            console.log("Upsert user")
            await upsertUser(
              finalPrompt
              // + "--//After responding with an answer, give 3 suggestions for more questions the user can ask"
            );
          } else {
            res.json(400).send("There was an error sending your query");
          }
        } else {
          console.log("Create user")
          await createUser(
            finalPrompt
            // + "--//After responding with an answer, give 3 suggestions for more questions the user can ask"
          );
        }
      } catch (err) {
        console.log(err);
      }
    };

    const processAnswers = async (pages) => {
      // try {
      //   function delay(ms) {
      //     return new Promise(resolve => setTimeout(resolve, ms));
      //   }

      //     const result = delay(7000).then(async () => {
      try {
        const history = await getChatHistory();
        console.log("Start process answers success");

        // Define the number of elements to log (e.g., 20)
        const elementsToRemember = 7;

        // Use a conditional statement to slice the array
        const lastElements =
          history.length > elementsToRemember
            ? history.slice(-elementsToRemember)
            : history;
            
            // Remove the time key-value pair from each object
            const queryWithoutPageTime = lastElements.map(item => {
              const { time, pages, ...rest } = item; // Destructure the object, omitting the 'time' key
              return rest; // Return the object without the 'time' key-value pair
            });
            
            console.log(queryWithoutPageTime);

        const chatCompletion = await openai.chat.completions.create({
          messages: queryWithoutPageTime,
          model: "gpt-3.5-turbo-1106",
          max_tokens: 2048,
        });

        // let chatResponse = ""

        // for await (const chunk of stream) {
        //   res.write(`data: ${JSON.stringify({ responses: process.stdout.write(chunk.choices[0]?.delta?.content || "") })}\n\n`)
        // }

        // res.end()

        //eventSource.onmessage = (event) => {
        //JSON.parse(event.data).response;
        //console.log('Received chunk from backend:', responseData)
        //}

        //eventSource.error = (error) => {
        // console.error('Error:')
        // }

        console.log("Chat completion success: " + chatCompletion);

        const chatResponse = chatCompletion.choices[0].message.content;

        console.log(
          "This is the history last role. It should be user: " +
            history[history.length - 1].role
        );

        if (history[history.length - 1].role === "user") {
          await upsertAssistant(chatResponse, pages);
        } else {
          console.log("This was the error");
          res.json(400).send("There was an error sending your query");
        }

        const history2 = await getChatHistory();

        const result = {
          query: history2,
          completion: chatResponse,
        };

        return result;
      } catch (err) {
        console.log(err);
        res.json(400).send("There was an error sending your query: " + err);
      }
      // })
      // return result
      // } catch (err) {
      //   console.log(err)
      //   const history = await getChatHistory()
      //   if(history.length % 2 !== 0 && history.length !== 0 && history[history.length-1].role === "user"){
      //     deleteLastQuestion()
      //   }
      // }
    };

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
        console.log(err);
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

        if (similarityScores.length > 0 && nameOfFile !== "global") {
          // Select the top 5 pages
          const top5SimilarPages = similarityScores.slice(0, 5);
          console.log(top5SimilarPages);

          if (top5SimilarPages[0].similarity < 0.7) {
            console.log("Highest similarity score was less than 0.75");
            try {
              if (retryQuery === undefined) {
                await checkIfRowExists(query);
              }
              const result = await processAnswers(String(top5SimilarPages[0].pageData.page_number));

              console.log("All processes have been completed successfully");

              res.status(200).json(result);
            } catch (error) {
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
            // To get the results

            const mostSimilar = top5SimilarPages[0].pageData.page_text;
            const inputText = mostSimilar;

            const plainText = inputText.replace(/[+\n]/g, "");

            console.log("Highest similarity info chosen");

            if (retryQuery === undefined) {
              const instructions =
                "You will be provided with information from a document called " +
                top5SimilarPages[0].pageData.pdf_name +
                " from page " +
                String(top5SimilarPages[0].pageData.page_number) +
                " delimited by tripple quotes and a question. Your task is to answer the question using only the provided document and to cite passages of the document used to anser the question. If an answer to a question is provided, it must be annotated with the page number. Use the following format for annotating the pages ({Page: " +
                String(top5SimilarPages[0].pageData.page_number) +
                "})";

              //   const finalPrompt = `
              //   Info: Using this info: ${plainText} make the answer as explanatory as possible. With points and examples
              //   Question://--${query}--//.
              //   Answer:
              // `;

              const finalPrompt =
                instructions +
                `\n """${plainText}"""` +
                ` \nQuestion://--${query}--//`;

              try {
                await checkIfRowExists(finalPrompt);
                const result = await processAnswers(String(top5SimilarPages[0].pageData.page_number));

                console.log("All processes have been completed successfully");

                res.status(200).json(result);
              } catch (error) {
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
              try {
                const result = await processAnswers("");

                console.log("All processes have been completed successfully");

                res.status(200).json(result);
              } catch (error) {
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
          }
        } else {
          // Handle the case where there are no similarity scores
          console.log("No similarity scores found.");
          try {
            if (retryQuery === undefined) {
              await checkIfRowExists(query);
            }
            const result = await processAnswers("");

            console.log("All processes have been completed successfully");

            res.status(200).json(result);
          } catch (error) {
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
        console.log(err);
      }
    }

    await calculateSimilarityScores(xq, pdfData);
  } catch (err) {
    console.log(err);
  }
});

const port = 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
