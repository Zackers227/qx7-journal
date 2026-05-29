@echo off
chcp 65001 >nul
git add .
git commit -m "Auto commit %date% %time%"
git push -u origin main
echo Done!
pause