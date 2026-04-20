# devops-api — Ambiente Produtivo com Simulação de Incidente Real

API Node.js containerizada rodando em produção no AWS EKS, com observabilidade completa via Prometheus e Grafana, simulação de incidente, troubleshooting, análise de causa raiz e rollback documentados.

**Criado por:** Jonathan Souza  
**Área:** Site Reliability Engineering (SRE)

---

## Objetivo do projeto

Demonstrar na prática as responsabilidades de um SRE em um ambiente produtivo real na AWS:

- Provisionar e operar um cluster Kubernetes (EKS) em produção
- Implementar observabilidade com coleta de métricas e dashboards
- Simular e responder a um incidente real (CrashLoopBackOff)
- Executar troubleshooting, análise de causa raiz e rollback
- Garantir a resiliência e recuperação automática da aplicação

---

## Stack utilizada

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js |
| Framework | Express.js |
| Métricas | prom-client |
| Container | Docker |
| Registry | AWS ECR |
| Orquestração | AWS EKS (Kubernetes) |
| Exposição | Kubernetes LoadBalancer (AWS ELB) |
| Monitoramento | Prometheus (kube-prometheus-stack) |
| Dashboards | Grafana |
| Instalação | Helm |

---

## Arquitetura

```
                        ┌─────────────────────────────────────────┐
                        │              AWS EKS Cluster             │
                        │                                          │
  Usuário               │   ┌──────────┐      ┌────────────────┐  │
    │                   │   │  Service │      │   devops-api   │  │
    └──► AWS ELB ───────┼──►│  (LB)   │─────►│     Pod(s)     │  │
                        │   └──────────┘      │                │  │
                        │                     │ GET /          │  │
                        │   ┌──────────────┐  │ GET /health    │  │
                        │   │  Prometheus  │◄─│ GET /error     │  │
                        │   └──────┬───────┘  │ GET /metrics   │  │
                        │          │          └────────────────┘  │
                        │   ┌──────▼───────┐                      │
                        │   │   Grafana    │                      │
                        │   └──────────────┘                      │
                        └─────────────────────────────────────────┘
```

---

## Estrutura do projeto

```
.
├── app.js               # Aplicação principal
├── Dockerfile           # Build da imagem
├── deployment.yaml      # Deploy no Kubernetes
├── service.yaml         # Exposição via LoadBalancer
├── servicemonitor.yaml  # Configuração do Prometheus para raspar métricas
└── README.md
```

---

## Endpoints

| Método | Rota      | Descrição                                    |
|--------|-----------|----------------------------------------------|
| GET    | /         | Retorna `Api OK!`                            |
| GET    | /health   | Retorna `healthy` (status 200)               |
| GET    | /error    | Executa `process.exit(1)` — simula incidente |
| GET    | /metrics  | Expõe métricas para o Prometheus             |

---

## Como rodar localmente

```bash
npm install express prom-client
node app.js
```

Acesse: `http://localhost:3000`

---

## Como rodar com Docker

```bash
docker build -t devops-api .
docker run -p 3000:3000 devops-api
```

---

## Deploy na AWS

### 1. Autenticar no ECR

```bash
aws ecr get-login-password --region <sua-region> | docker login --username AWS --password-stdin <sua-conta>.dkr.ecr.<sua-region>.amazonaws.com
```

### 2. Build, tag e push da imagem

```bash
docker build -t devops-api .
docker tag devops-api:latest <sua-conta>.dkr.ecr.<sua-region>.amazonaws.com/devops-api:latest
docker push <sua-conta>.dkr.ecr.<sua-region>.amazonaws.com/devops-api:latest
```

> Atualize o campo `image` no `deployment.yaml` com a URI do seu ECR.

### 3. Aplicar os manifests no EKS

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f servicemonitor.yaml
```

### 4. Verificar o deploy

```bash
kubectl get pods
kubectl get svc devops-service
```

### 5. Forçar novo deploy após atualização de imagem

```bash
kubectl rollout restart deployment devops-api
```

---

## Observabilidade

### Instalar Prometheus + Grafana via Helm

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

### Acessar o Grafana

```bash
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring
```

Acesse: `http://localhost:3000`

```bash
# Senha do Grafana
kubectl get secret monitoring-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Como o Prometheus coleta as métricas

O `ServiceMonitor` instrui o Prometheus a raspar o endpoint `/metrics` da aplicação a cada 15 segundos. As métricas são expostas via `prom-client` diretamente no processo Node.js.

```
Pod /metrics  →  Prometheus coleta (a cada 15s)  →  Grafana exibe nos dashboards
```

### Queries utilizadas no Grafana

| O que monitora | Query |
|---|---|
| Total de requisições | `http_requests_total` |
| Requisições por rota | `sum by (route) (http_requests_total)` |
| CPU do pod | `rate(container_cpu_usage_seconds_total{pod=~"devops-api.*"}[5m])` |
| Memória do pod | `container_memory_usage_bytes{pod=~"devops-api.*"}` |
| Restarts do pod | `kube_pod_container_status_restarts_total{pod=~"devops-api.*"}` |

### Dashboard

Importe o dashboard ID `15661` no Grafana para visualizar CPU, memória, rede e pods do cluster completo.

---

## Simulação de Incidente

### Trigger do incidente

```bash
curl http://<EXTERNAL-IP>/error
```

O endpoint `/error` executa `process.exit(1)`, derrubando o processo Node.js dentro do container.

### O que acontece

```
GET /error
  → process.exit(1)
  → container termina com exit code 1
  → Kubernetes detecta o pod como CrashLoopBackOff
  → Kubernetes reinicia o pod automaticamente
  → Pod volta ao estado Running
```

### Acompanhar o incidente em tempo real

```bash
# Ver o status do pod mudando
kubectl get pods -w

# Ver os logs do pod
kubectl logs -f -l app=devops-api

# Ver detalhes e histórico de eventos do pod
kubectl describe pod -l app=devops-api
```

---

## Troubleshooting e Análise de Causa Raiz

### Identificação do problema

```bash
# 1. Verificar estado dos pods
kubectl get pods

# Saída esperada durante o incidente:
# NAME                          READY   STATUS             RESTARTS   AGE
# devops-api-xxxx               0/1     CrashLoopBackOff   3          5m
```

```bash
# 2. Inspecionar os eventos do pod
kubectl describe pod -l app=devops-api

# Procurar na seção Events:
# Warning  BackOff   kubelet   Back-off restarting failed container
```

```bash
# 3. Verificar os logs do container que falhou
kubectl logs -l app=devops-api --previous
```

### Causa raiz

O endpoint `GET /error` executa `process.exit(1)` intencionalmente, simulando uma falha crítica no processo da aplicação. O container encerra com código de saída diferente de zero, o que o Kubernetes interpreta como falha e aciona o mecanismo de restart automático.

### Resolução

O Kubernetes resolve automaticamente via restart policy. Em um cenário real, a resolução envolveria identificar o código que causou o crash, corrigir, gerar nova imagem e fazer rollback ou redeploy.

---

## Rollback

### Verificar histórico de deploys

```bash
kubectl rollout history deployment devops-api
```

### Executar rollback para a versão anterior

```bash
kubectl rollout undo deployment devops-api
```

### Verificar status do rollback

```bash
kubectl rollout status deployment devops-api
```

### Rollback para uma revisão específica

```bash
kubectl rollout undo deployment devops-api --to-revision=<numero>
```

---

## Competências SRE demonstradas neste projeto

| Competência | Como foi aplicada |
|---|---|
| Operação em EKS | Provisionamento do cluster, deploy de workloads, gestão de pods e services |
| Observabilidade | Implementação de métricas customizadas com prom-client, ServiceMonitor e dashboards no Grafana |
| Resposta a incidentes | Simulação de CrashLoopBackOff e acompanhamento em tempo real via kubectl e Grafana |
| Troubleshooting | Uso de `kubectl describe`, `kubectl logs` e eventos do pod para identificar a causa raiz |
| Análise de causa raiz | Identificação do exit code e rastreamento do comportamento do processo |
| Rollback | Uso de `kubectl rollout undo` para reversão controlada de deploy |
| Resiliência | Validação do mecanismo de restart automático do Kubernetes |
