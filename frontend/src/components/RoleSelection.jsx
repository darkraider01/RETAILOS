import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User } from 'lucide-react';

export default function RoleSelection({ onSelectRole, currentRole }) {
  const roles = [
    { name: 'Customer', role: 'customer' },
    { name: 'Manager', role: 'manager' },
    { name: 'Supplier', role: 'supplier' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          {currentRole ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) : 'Select Role'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {roles.map((roleOption) => (
          <DropdownMenuItem 
            key={roleOption.role}
            onClick={() => onSelectRole({ full_name: roleOption.name, role: roleOption.role })}
            className={currentRole === roleOption.role ? 'bg-gray-100' : ''}
          >
            {roleOption.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}