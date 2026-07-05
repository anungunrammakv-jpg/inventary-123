@echo off
chcp 65001 >nul
echo Запускаем сервер базы данных и клиентское приложение...
echo Пожалуйста, подождите.

:: Запускаем сервер в отдельном окне
start "Inventory Server" cmd /k "npm run dev:server"

:: Запускаем клиент (Vite) в отдельном окне
start "Inventory Client" cmd /k "npm run dev:client"

exit