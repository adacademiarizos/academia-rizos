$nodes = tasklist /FI "IMAGENAME eq node.exe" /FO CSV | ConvertFrom-Csv
foreach ($n in $nodes) {
  $thePid = $n.PID
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$thePid" -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Output "PID=$thePid"
    Write-Output $proc.CommandLine
    Write-Output '---'
  }
}