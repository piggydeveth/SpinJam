// returns either [gifUrl, gifBlob] or null if error
async function makeGif(ffmpeg) {
  try {
    await ffmpeg.run(
      // since png transparent backgrounds and however ffmpeg creates gifs doesn't, we have to convert all transparent color to white.
      // we could also add a background to the canvas, or change the background color since it defaults to transparent
      // ffmpeg -f image2 -framerate 1 -i giff%d.png -vf "format=yuva444p,geq='if(lte(alpha(X,Y),16),255,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))'" out.gif
      "-f",
      "image2",
      "-framerate",
      "1",
      "-i",
      "f%3d.png",
      "-vf",
      "format=yuva444p,geq='if(lte(alpha(X,Y),16),255,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))':'if(lte(alpha(X,Y),16),128,p(X,Y))'",
      "test.gif",
    );

    const data = ffmpeg.FS("readFile", "test.gif");
    let gifBlob = new Blob([data.buffer], { type: "image/gif" });
    let gifUrl = URL.createObjectURL(gifBlob);
    return [gifUrl, gifBlob];
  } catch (e) {
    console.log(e, "couldn't make gif");
  }
  return null;
}
