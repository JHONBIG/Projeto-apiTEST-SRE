coloque aqui as imformaçoes
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 092276958624.dkr.ecr.us-east-1.amazonaws.com

docker build -t devops-api .

docker tag devops-api:latest 092276958624.dkr.ecr.us-east-1.amazonaws.com/devops-api:latest

docker push 092276958624.dkr.ecr.us-east-1.amazonaws.com/devops-api:latest
