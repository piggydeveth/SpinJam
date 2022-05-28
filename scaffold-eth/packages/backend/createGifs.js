import fs from "fs";
import { exec } from "child_process";

function pad(num, size) {
  num = num.toString();
  while (num.length < size) num = "0" + num;
  return num;
}

export default async function createGifs(drawings) {
  const sortedPictures = sortPictures(drawings);
  const tempDir = "temp" + (Math.random() % 10000);
  fs.mkdirSync(tempDir);

  await Promise.all(
    sortedPictures.map((pics, i) =>
      Promise.all(
        pics.map((pic, j) => {
          const fileName = tempDir + "/" + i + "_" + pad(j, 3) + ".png";
          sortedPictures[i][j] = fileName;
          return new Promise((resolve, reject) => {
            fs.writeFile(fileName, pic, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        })
      )
    )
  );
  console.log("created files");
  //   ffmpeg -f image2 -framerate 1 -i tempvM1yQM/0_%3d.png -vf "format=yuva444p,geq='if(lte(alpha(X,Y),16),255,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))'" test.gif
  const ffmpeger = async (tempDir, i) =>
    await new Promise((resolve, reject) => {
      const gifName = `${tempDir}/out_${i}.gif`;
      exec(
        `ffmpeg -f image2 -framerate 1 -i ${tempDir}/${i}_%3d.png -vf "format=yuva444p,geq='if(lte(alpha(X,Y),16),255,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))'" ${gifName}`,
        (err) => {
          if (err) {
            reject(err);
          }
          resolve(gifName);
        }
      );
    });
  console.log("creating gifs");
  const gifs = await Promise.all(
    sortedPictures.map((_, i) => ffmpeger(tempDir, i))
  );
  console.log("created gifs");
  return gifs;
}
function sortPictures(drawings) {
  const sortedGifs = [];
  let numOfDrawings = Number.MAX_SAFE_INTEGER;
  const users = Object.keys(drawings);
  users.forEach((user) => {
    const userDrawings = drawings[user];
    if (userDrawings.length < numOfDrawings) {
      numOfDrawings = userDrawings.length;
    }
  });
  let numOfGifs = users.length;

  for (let gif = 0; gif < numOfGifs; gif++) {
    for (let drawing = 0; drawing < numOfDrawings; drawing++) {
      if (!sortedGifs[gif]) {
        sortedGifs[gif] = new Array(0);
      }
      const userIndex = (drawing + gif) % numOfGifs;
      const userKey = users[userIndex];
      sortedGifs[gif].push(drawings[userKey][drawing]);
    }
  }

  return sortedGifs;
}
