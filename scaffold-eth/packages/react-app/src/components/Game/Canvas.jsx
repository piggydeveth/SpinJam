import React, { useState, useEffect } from "react";
import { ReactPainter } from "react-painter";

// submit receives a blob, onion source is expected to be an img url
function Canvas({ submit, onionSkin }) {
  // add button to save last image on canvas
  // add button to add another onion frame
  const [blob, setBlob] = useState(null);
  useEffect(() => {
    if (blob) {
      submit(blob);
    }
  }, [blob]);
  const Drawable = () => (
    <ReactPainter
      width={300}
      height={300}
      onSave={blob => {
        // makes the painter re-render, but gets `Can't perform a React state update on an unmounted component` err
        setBlob(blob);
      }}
      render={({ triggerSave, canvas }) => (
        <div>
          <button onClick={triggerSave}>submit</button>
          <div
            style={{
              position: "relative",
            }}
          >
            <img
              style={{
                position: "absolute",
                zIndex: "-10",
                opacity: "10%",
              }}
              alt=""
              src={onionSkin}
            />
            {canvas}
          </div>
        </div>
      )}
    />
  );

  return <Drawable />;
}

export default Canvas;
