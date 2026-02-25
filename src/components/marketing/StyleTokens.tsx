"use client";

const BRAND = {
  copper: "#B16E34",
  beige: "#f6f2e7",
  olive: "#646A40",
};

function StyleTokens() {
  return (
    <style jsx global>{`
      :root {
        --er-beige: ${BRAND.beige};
        --er-copper: ${BRAND.olive};
        --er-olive: ${BRAND.olive};
      }
    `}</style>
  );
}

export default StyleTokens