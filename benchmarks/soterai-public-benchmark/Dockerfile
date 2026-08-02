# SoterAI Public Benchmark — reproducible, witness-friendly harness
# Build:  docker build -t soterai-bench .
# Run:    docker run --rm soterai-bench
# Out:    JSON results printed to stdout; mount -v %cd%/results:/out to persist
FROM node:20-alpine
WORKDIR /bench
COPY ./corpus ./corpus
COPY ./manifest.json ./manifest.json
COPY ./run.mjs ./run.mjs
RUN sha256sum ./manifest.json ./run.mjs ./corpus/* > /bench/HASHES.txt || sha256sum ./manifest.json > /bench/HASHES.txt
CMD ["node", "run.mjs"]
