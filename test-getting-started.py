import pexpect
import sys
import time

child = pexpect.spawn('bash ./scripts/getting-started.sh', encoding='utf-8')
child.logfile = sys.stdout

# Wait for "Press Enter to begin..."
child.expect('Press Enter to begin...', timeout=5)
child.sendline('')
time.sleep(1)

# Wait for "Press Enter to continue..." (Environment check)
child.expect('Press Enter to continue...', timeout=5)
child.sendline('')
time.sleep(1)

# Wait for "Press Enter to continue..." (Dependencies)
child.expect('Press Enter to continue...', timeout=5)
child.sendline('')
time.sleep(1)

# Wait for "Rebuild? [y/N]: " OR "Press Enter to continue..."
index = child.expect(['Rebuild\? \[y/N\]: ', 'Press Enter to continue...'], timeout=5)
if index == 0:
    child.sendline('N')
    child.expect('Press Enter to continue...', timeout=5)
    child.sendline('')
elif index == 1:
    child.sendline('')
time.sleep(1)

# Wait for choice
child.expect(r'Enter choice \[1-5\]: ', timeout=5)
child.sendline('4') # Manual Exploration

# Expect script to finish
child.expect(pexpect.EOF, timeout=5)
