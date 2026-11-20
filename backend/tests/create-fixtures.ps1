Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(100, 100)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.Clear([System.Drawing.Color]::Red)
$bmp.Save('D:\projects\resutrant-system\Bhansa\backend\tests\fixtures\test-image.jpg', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Save('D:\projects\resutrant-system\Bhansa\backend\tests\fixtures\test-image.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save('D:\projects\resutrant-system\Bhansa\backend\tests\fixtures\test-image.gif', [System.Drawing.Imaging.ImageFormat]::Gif)
$graphics.Dispose()
$bmp.Dispose()