import { useState } from 'react';

import { Button } from '@/components/ui/button.tsx';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card.tsx';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useTranslation } from '@/i18n/useI18n.ts';
import { cn } from '@/lib/utils.ts';

interface Props {
	onComplete: () => void;
	className?: string;
}

const DEMO_SERVER_URL = 'http://127.0.0.1:8000';
const DEMO_USERNAME = 'acme:alice';

export const SetupPage = ({ onComplete, className }: Props) => {
	const { t } = useTranslation();
	const [url, setUrl] = useState(() => localStorage.getItem('server_url') ?? DEMO_SERVER_URL);
	const [username, setUsername] = useState(
		() => localStorage.getItem('username') ?? DEMO_USERNAME,
	);

	const completeSetup = (nextUrl: string, nextUsername: string) => {
		localStorage.setItem('server_url', nextUrl);
		localStorage.setItem('username', nextUsername);
		onComplete();
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		completeSetup(url, username);
	};

	const handleUseDemo = () => {
		setUrl(DEMO_SERVER_URL);
		setUsername(DEMO_USERNAME);
		completeSetup(DEMO_SERVER_URL, DEMO_USERNAME);
	};

	return (
		<div className="flex items-center justify-center h-full">
			<div className={cn('flex flex-col gap-6 w-full max-w-sm', className)}>
				<Card>
					<CardHeader>
						<CardTitle>{t('setup.title')}</CardTitle>
						<CardDescription>{t('setup.description')}</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="server-url-input">
										{t('setup.serverUrl')}
									</FieldLabel>
									<Input
										id="server-url-input"
										type="url"
										placeholder={t('setup.serverUrlPlaceholder')}
										value={url}
										onChange={(e) => setUrl(e.target.value)}
										required
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="username-input">
										{t('setup.username')}
									</FieldLabel>
									<Input
										id="username-input"
										type="text"
										placeholder={t('setup.usernamePlaceholder')}
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										required
									/>
								</Field>
								<Field>
									<Button type="submit" className="w-full">
										{t('setup.submit')}
									</Button>
								</Field>
								<Field className="gap-2 rounded-lg border bg-muted/30 p-3">
									<div>
										<FieldLabel>{t('setup.demoTitle')}</FieldLabel>
										<FieldDescription>{t('setup.demoDescription')}</FieldDescription>
									</div>
									<Button type="button" variant="outline" onClick={handleUseDemo} className="w-full">
										{t('setup.useDemo')}
									</Button>
								</Field>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>
				<FieldDescription className="px-6 text-center">{t('setup.hint')}</FieldDescription>
			</div>
		</div>
	);
};
