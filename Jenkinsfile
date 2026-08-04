// Jenkinsfile — Model Artifact Security Scan (SoterAI)
// Declarative pipeline. Requires SOTERAI_API_KEY in Jenkins credentials (secret text).

pipeline {
  agent any

  environment {
    SOTERAI_API_KEY = credentials("soterai-api-key") // secret text credential
  }

  stages {
    stage("Install") {
      steps { sh "node -v && npm -v" }
    }
    stage("SoterAI Model Scan") {
      steps {
        sh "npx soterai scan --path . --scan-depth=full --output artifacts/model-scan/"
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: "artifacts/model-scan/**/*", fingerprint: true
      junit allowEmptyResults: true, testResults: "artifacts/model-scan/**/*.xml"
    }
  }
}
