FROM node:18-alpine

WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY server.js .

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV PORT=8080
ENV DAILY_LIMIT=10
ENV DATA_DIR=/app/data

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 启动服务
CMD ["npm", "start"]