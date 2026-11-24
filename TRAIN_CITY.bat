@echo off
setlocal
cd /d "%~dp0"
set "PY=Z:\LIFEAFTERLOGIC\EXPERIMENTS\RTNVE\001\RTNVE-main\.venv\Scripts\python.exe"
if exist "%PY%" goto run
set "PY=%~dp0.venv\Scripts\python.exe"
if exist "%PY%" goto run
echo No CUDA PyTorch environment found.
echo Install CUDA PyTorch in .venv or edit this BAT to point at your working RTNVE python.exe.
pause
exit /b 1
:run
echo Citylife training uses your RTX 3090. Do not run alongside the overnight RTNVE render.
"%PY%" train.py --steps 3000
if errorlevel 1 echo Training failed. See the error above.
pause
